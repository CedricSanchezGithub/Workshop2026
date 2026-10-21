import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { z } from 'zod';
import { CreatePaymentIntent, IdempotencyConflictError, PaymentRequestError } from '../../shared/src/application/use-cases/CreatePaymentIntent.js';
import { GetPaymentIntent } from '../../shared/src/application/use-cases/GetPaymentIntent.js';
import { ProcessPaymentJob } from '../../shared/src/application/use-cases/ProcessPaymentJob.js';
import { ProcessRefundJob } from '../../shared/src/application/use-cases/ProcessRefundJob.js';
import { RefundPayment, RefundPaymentError } from '../../shared/src/application/use-cases/RefundPayment.js';
import { VerifyPaymentIntent, PaymentVerificationError } from '../../shared/src/application/use-cases/VerifyPaymentIntent.js';
import { InMemoryPaymentRepository } from '../../shared/src/infrastructure/repositories/InMemoryPaymentRepository.js';
import { PostgresPaymentRepository } from '../../shared/src/infrastructure/repositories/PostgresPaymentRepository.js';
import { InMemoryPaymentQueue } from '../../shared/src/infrastructure/queue/InMemoryPaymentQueue.js';
import { PostgresPaymentQueue } from '../../shared/src/infrastructure/queue/PostgresPaymentQueue.js';
import { MockPaymentGateway } from '../../shared/src/infrastructure/gateways/MockPaymentGateway.js';
import { ConsoleAuditLogger } from '../../shared/src/infrastructure/logging/ConsoleAuditLogger.js';
import { FakeSmtpMailer } from '../../shared/src/infrastructure/mail/FakeSmtpMailer.js';
import { InMemoryUserRepository } from '../../shared/src/infrastructure/repositories/InMemoryUserRepository.js';
import { PostgresUserRepository } from '../../shared/src/infrastructure/repositories/PostgresUserRepository.js';
import { InMemorySessionRepository } from '../../shared/src/infrastructure/repositories/InMemorySessionRepository.js';
import { PostgresSessionRepository } from '../../shared/src/infrastructure/repositories/PostgresSessionRepository.js';
import { ScryptPasswordHasher } from '../../shared/src/infrastructure/security/ScryptPasswordHasher.js';
import { JdenticonAvatarGenerator } from '../../shared/src/infrastructure/avatars/JdenticonAvatarGenerator.js';
import { RegisterUser, RegisterUserError } from '../../shared/src/application/use-cases/RegisterUser.js';
import { LoginUser, LoginUserError, AccountLockedError } from '../../shared/src/application/use-cases/LoginUser.js';
import { InMemoryLoginAttemptTracker } from '../../shared/src/infrastructure/security/InMemoryLoginAttemptTracker.js';
import { GetCurrentUser } from '../../shared/src/application/use-cases/GetCurrentUser.js';
import { InMemoryBookingQuoteRepository } from '../../shared/src/infrastructure/repositories/InMemoryBookingQuoteRepository.js';
import { PostgresBookingQuoteRepository } from '../../shared/src/infrastructure/repositories/PostgresBookingQuoteRepository.js';
import { PostgresDatabase } from '../../shared/src/infrastructure/database/PostgresDatabase.js';
import { toPaymentView } from '../../shared/src/application/mappers/PaymentView.js';
import { CHAT_SCOPE_MESSAGE, getLatestUserMessage, isPayGoTopic } from '../../shared/src/application/chat/ChatTopicGuard.js';
import { ChatAssistantError } from '../../shared/src/infrastructure/chat/OpenAIChatAssistant.js';
import { OpenAIChatAssistant } from '../../shared/src/infrastructure/chat/OpenAIChatAssistant.js';
import { openapiDocument } from './docs/openapi.js';
import { ApiMetrics } from './observability/Metrics.js';

const app = express();
const port = Number(process.env.PORT ?? 4000);
const webOrigins = new Set((process.env.WEB_ORIGIN ?? 'http://127.0.0.1:5173,http://localhost:5173').split(',').map((origin) => origin.trim()).filter(Boolean));
const postgresDatabase = process.env.STORAGE_DRIVER === 'postgres' ? new PostgresDatabase() : undefined;
const repository = postgresDatabase ? new PostgresPaymentRepository(postgresDatabase) : new InMemoryPaymentRepository();
const queue = process.env.QUEUE_DRIVER === 'postgres' && postgresDatabase ? new PostgresPaymentQueue(postgresDatabase) : new InMemoryPaymentQueue();
const audit = new ConsoleAuditLogger();
const gateway = new MockPaymentGateway();
const mailer = new FakeSmtpMailer();
const processPayment = new ProcessPaymentJob(repository, gateway, audit);
const processRefund = new ProcessRefundJob(repository, gateway, audit);
if (process.env.QUEUE_DRIVER !== 'postgres') queue.subscribe(async (job) => { if (job.type === 'payment.process') await processPayment.execute(job.paymentId); if (job.type === 'payment.refund') await processRefund.execute(job.paymentId); });
const bookingQuotes = postgresDatabase ? new PostgresBookingQuoteRepository(postgresDatabase) : new InMemoryBookingQuoteRepository();
const createPaymentIntent = new CreatePaymentIntent(repository, audit, mailer, bookingQuotes);
const verifyPaymentIntent = new VerifyPaymentIntent(repository, queue, audit, mailer);
const refundPayment = new RefundPayment(repository, queue, audit);
const getPaymentIntent = new GetPaymentIntent(repository);
const userRepository = postgresDatabase ? new PostgresUserRepository(postgresDatabase) : new InMemoryUserRepository();
const sessionRepository = postgresDatabase ? new PostgresSessionRepository(postgresDatabase) : new InMemorySessionRepository();
const adminEmails = new Set((process.env.ADMIN_EMAILS ?? '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean));
const registerUser = new RegisterUser(userRepository, sessionRepository, new ScryptPasswordHasher(), new JdenticonAvatarGenerator(), adminEmails);
// Anti-bruteforce (WOR-98) : après AUTH_MAX_ATTEMPTS échecs, verrou de AUTH_LOCK_MINUTES (croissant).
const loginAttempts = new InMemoryLoginAttemptTracker(
  Number(process.env.AUTH_MAX_ATTEMPTS ?? 2),
  Number(process.env.AUTH_LOCK_MINUTES ?? 5) * 60_000,
);
const loginUser = new LoginUser(userRepository, sessionRepository, new ScryptPasswordHasher(), loginAttempts);
const getCurrentUser = new GetCurrentUser(userRepository, sessionRepository);
const chatAssistant = new OpenAIChatAssistant();
const metrics = new ApiMetrics();

function routeTemplate(request: Request): string {
  const route = request.route?.path;
  if (typeof route === 'string') return route.replace(/:([^/]+)/g, '{$1}');
  if (Array.isArray(route) && typeof route[0] === 'string') return route[0].replace(/:([^/]+)/g, '{$1}');
  return 'unmatched';
}

function chunkLength(chunk: unknown, encoding?: unknown): number {
  if (chunk === null || chunk === undefined) return 0;
  if (typeof chunk === 'string') return Buffer.byteLength(chunk, typeof encoding === 'string' ? encoding as BufferEncoding : 'utf8');
  if (Buffer.isBuffer(chunk)) return chunk.byteLength;
  if (chunk instanceof Uint8Array) return chunk.byteLength;
  return 0;
}

function isDatabaseError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && (/^\d[A-Z0-9]{4}$/.test(code) || ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'].includes(code));
}

app.disable('x-powered-by');
// Derrière le WAF : req.ip = client réel (X-Forwarded-For posé par le WAF), sinon tous les clients
// partagent la même IP et le même quota de rate-limit (60 req/min pour toute la plateforme).
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: (origin, callback) => {
  if (!origin || webOrigins.has(origin)) return callback(null, true);
  try {
    const parsed = new URL(origin);
    const localAlias = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    const sameLocalPort = [...webOrigins].some((allowed) => { try { const configured = new URL(allowed); return (configured.hostname === 'localhost' || configured.hostname === '127.0.0.1') && configured.port === parsed.port; } catch { return false; } });
    return callback(null, localAlias && sameLocalPort);
  } catch { return callback(null, false); }
}, methods: ['GET', 'POST'], allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'] }));
app.use(express.json({ limit: '32kb' }));
app.use((request, response, next) => {
  if (request.path === '/metrics') return next();

  const started = process.hrtime.bigint();
  const bodyLength = Number(request.header('content-length') ?? 0) || 0;
  const queryLength = request.originalUrl.includes('?') ? request.originalUrl.length - request.originalUrl.indexOf('?') - 1 : 0;
  const requestLength = Buffer.byteLength(request.originalUrl) + bodyLength;
  let responseBytes = 0;
  const originalWrite = response.write.bind(response);
  const originalEnd = response.end.bind(response);

  (response as any).write = (chunk: unknown, encoding?: unknown, callback?: unknown) => {
    responseBytes += chunkLength(chunk, encoding);
    return (originalWrite as any)(chunk, encoding, callback);
  };
  (response as any).end = (chunk?: unknown, encoding?: unknown, callback?: unknown) => {
    responseBytes += chunkLength(chunk, encoding);
    return (originalEnd as any)(chunk, encoding, callback);
  };

  response.on('finish', () => {
    const durationSeconds = Number(process.hrtime.bigint() - started) / 1_000_000_000;
    const route = routeTemplate(request);
    const status = String(response.statusCode);
    const recordedResponseBytes = responseBytes || Number(response.getHeader('content-length') ?? 0) || 0;
    metrics.httpRequestsTotal.inc({ method: request.method, route, status });
    metrics.httpRequestDurationSeconds.observe({ route }, durationSeconds);
    metrics.httpResponseBytesTotal.inc({ route }, recordedResponseBytes);
    metrics.httpRequestBytes.observe({ route }, requestLength);
    console.info(JSON.stringify({
      event: 'http',
      client_ip: request.header('x-real-ip') ?? request.socket.remoteAddress ?? 'unknown',
      ts: Date.now() / 1000,
      method: request.method,
      route,
      path: request.path,
      query_len: queryLength,
      body_len: bodyLength,
      status: response.statusCode,
      latency_ms: durationSeconds * 1000,
      resp_bytes: recordedResponseBytes,
      ua: request.header('user-agent') ?? '',
    }));
  });

  next();
});
app.use(rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use(['/v1/auth', '/v1/payments'], (_request, response, next) => { response.setHeader('Cache-Control', 'no-store'); next(); });
const authRateLimit = rateLimit({ windowMs: 15 * 60_000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false });
const chatRateLimit = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });

app.get('/openapi.json', (_request, response) => response.json(openapiDocument));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiDocument, { customSiteTitle: 'Pay&Go API — Swagger' }));

const paymentSchema = z.object({ bookingId: z.string().regex(/^booking_\d+$/).max(80), amountCents: z.number().int().positive().max(2_000_000), currency: z.literal('EUR'), paymentMethod: z.object({ token: z.string().regex(/^pm_mock_[a-z0-9-]{12,128}$/), last4: z.string().regex(/^\d{4}$/), brand: z.enum(['visa', 'mastercard', 'amex', 'other']), email: z.string().email() }).strict() }).strict();
const registerSchema = z.object({ name: z.string().trim().min(2).max(80), email: z.string().email().max(160), password: z.string().min(8).max(128) });
const loginSchema = z.object({ email: z.string().email().max(160), password: z.string().min(1).max(128) });
const adminScalingSchema = z.object({ workerCount: z.number().int().min(1).max(10) }).strict();
const chatSchema = z.object({ messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(1_000) }).strict()).min(1).max(12) }).strict();

type AuthenticatedRequest = Request & { userId?: string; sessionToken?: string };

async function authenticate(request: AuthenticatedRequest, response: Response, next: NextFunction) {
  const authorization = request.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return response.status(401).json({ error: 'UNAUTHORIZED' });
  const session = await sessionRepository.find(token);
  if (!session) return response.status(401).json({ error: 'UNAUTHORIZED' });
  request.userId = session.userId;
  request.sessionToken = token;
  next();
}

async function authenticateAdmin(request: AuthenticatedRequest, response: Response, next: NextFunction) {
  const authorization = request.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return response.status(401).json({ error: 'UNAUTHORIZED' });
  const session = await sessionRepository.find(token);
  if (!session) return response.status(401).json({ error: 'UNAUTHORIZED' });
  const user = await userRepository.findById(session.userId);
  if (!user || user.role !== 'admin') return response.status(403).json({ error: 'ADMIN_REQUIRED' });
  request.userId = session.userId;
  request.sessionToken = token;
  next();
}

async function buildAdminOverview() {
  const payments = await repository.list();
  const paymentStatuses = payments.reduce<Record<string, number>>((counts, payment) => { counts[payment.status] = (counts[payment.status] ?? 0) + 1; return counts; }, {});
  const queueStatus = await queue.getStatus();
  return {
    generatedAt: new Date().toISOString(),
    services: [
      { name: 'API paiement', key: 'payment-api', status: 'operational', detail: 'Routes Express disponibles' },
      { name: 'Queue paiement', key: 'payment-queue', status: 'operational', detail: `${queueStatus.workerCount} worker(s) configuré(s)` },
      { name: 'Worker paiement', key: 'payment-worker', status: queueStatus.activeWorkers > queueStatus.workerCount ? 'degraded' : 'operational', detail: `${queueStatus.activeWorkers} traitement(s) actif(s)` },
      { name: 'SMTP de vérification', key: 'smtp', status: 'operational', detail: 'Fake SMTP actif' },
      { name: 'Gateway paiement', key: 'gateway', status: 'operational', detail: 'Mock gateway actif' },
    ],
    metrics: { users: await userRepository.count(), payments: payments.length, paymentStatuses, queue: queueStatus },
    scaling: { minWorkers: 1, maxWorkers: 10, workerCount: queueStatus.workerCount },
  };
}

app.get('/health', (_request, response) => response.json({ status: 'ok', service: 'payment-api' }));
app.get('/metrics', (_request, response) => {
  response.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  return response.send(metrics.renderPrometheus());
});

app.post('/v1/chat', chatRateLimit, async (request, response, next) => {
  try {
    const input = chatSchema.parse(request.body);
    const latestUserMessage = getLatestUserMessage(input.messages);
    if (!latestUserMessage || !isPayGoTopic(latestUserMessage)) return response.status(422).json({ error: 'CHAT_SCOPE_ONLY', message: CHAT_SCOPE_MESSAGE });
    const message = await chatAssistant.reply(input.messages);
    return response.json({ data: { message } });
  } catch (error) {
    return next(error);
  }
});

app.get('/v1/admin/overview', authenticateAdmin, async (_request, response) => response.json({ data: await buildAdminOverview() }));

app.post('/v1/admin/scaling', authenticateAdmin, async (request: AuthenticatedRequest, response, next) => {
  try {
    const input = adminScalingSchema.parse(request.body);
    await queue.scale(input.workerCount);
    return response.json({ data: await buildAdminOverview() });
  } catch (error) {
    return next(error);
  }
});

app.post('/v1/auth/register', authRateLimit, async (request, response, next) => {
  try {
    const input = registerSchema.parse(request.body);
    return response.status(201).json({ data: await registerUser.execute(input) });
  } catch (error) {
    return next(error);
  }
});

app.post('/v1/auth/login', authRateLimit, async (request, response, next) => {
  try {
    const input = loginSchema.parse(request.body);
    return response.json({ data: await loginUser.execute(input) });
  } catch (error) {
    if (error instanceof LoginUserError) metrics.loginFailuresTotal.inc();
    return next(error);
  }
});

app.get('/v1/auth/me', authenticate, async (request: AuthenticatedRequest, response) => {
  const user = request.sessionToken ? await getCurrentUser.execute(request.sessionToken) : undefined;
  return user ? response.json({ data: user }) : response.status(401).json({ error: 'UNAUTHORIZED' });
});

app.post('/v1/auth/logout', authenticate, async (request: AuthenticatedRequest, response) => {
  if (request.sessionToken) await sessionRepository.delete(request.sessionToken);
  return response.json({ data: { ok: true } });
});

app.post('/v1/payments/intents', authenticate, async (request: AuthenticatedRequest, response, next) => {
  try {
    const idempotencyKey = request.header('idempotency-key');
    if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      metrics.paymentsTotal.inc({ status: 'rejected' });
      return response.status(400).json({ error: 'INVALID_IDEMPOTENCY_KEY' });
    }
    const input = paymentSchema.parse(request.body);
    const result = await createPaymentIntent.execute({ bookingId: input.bookingId, amountCents: input.amountCents, currency: input.currency, userId: request.userId!, idempotencyKey, paymentMethodToken: input.paymentMethod.token, paymentMethodLast4: input.paymentMethod.last4, paymentMethodBrand: input.paymentMethod.brand, payerEmail: input.paymentMethod.email });
    metrics.paymentsTotal.inc({ status: 'accepted' });
    return response.status(result.reused ? 200 : 202).json({ data: toPaymentView(result.payment), idempotentReplay: result.reused, verification: result.verification });
  } catch (error) {
    metrics.paymentsTotal.inc({ status: error instanceof PaymentRequestError || error instanceof IdempotencyConflictError || error instanceof z.ZodError ? 'rejected' : 'error' });
    return next(error);
  }
});

app.post('/v1/payments/:paymentId/verify', authenticate, async (request: AuthenticatedRequest, response, next) => {
  try {
    const code = z.object({ code: z.string().regex(/^\d{6}$/) }).parse(request.body).code;
    const payment = await getPaymentIntent.execute(String(request.params.paymentId));
    if (!payment || payment.userId !== request.userId) return response.status(404).json({ error: 'PAYMENT_NOT_FOUND' });
    const verified = await verifyPaymentIntent.execute(payment.id, code);
    return response.status(202).json({ data: toPaymentView(verified) });
  } catch (error) {
    return next(error);
  }
});

app.post('/v1/payments/:paymentId/refund', authenticate, async (request: AuthenticatedRequest, response, next) => {
  try {
    const payment = await getPaymentIntent.execute(String(request.params.paymentId));
    if (!payment || payment.userId !== request.userId) return response.status(404).json({ error: 'PAYMENT_NOT_FOUND' });
    const refund = await refundPayment.execute(payment.id);
    return response.status(202).json({ data: toPaymentView(refund) });
  } catch (error) {
    return next(error);
  }
});

app.get('/v1/payments/:paymentId', authenticate, async (request: AuthenticatedRequest, response) => {
  const payment = await getPaymentIntent.execute(String(request.params.paymentId));
  if (!payment || payment.userId !== request.userId) return response.status(404).json({ error: 'PAYMENT_NOT_FOUND' });
  return response.json({ data: toPaymentView(payment) });
});

app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
  if (isDatabaseError(error)) metrics.dbErrorsTotal.inc();
  if (error instanceof z.ZodError) return response.status(400).json({ error: request.path.startsWith('/v1/auth') ? 'INVALID_AUTH_REQUEST' : request.path.startsWith('/v1/admin') ? 'INVALID_ADMIN_REQUEST' : request.path.startsWith('/v1/chat') ? 'INVALID_CHAT_REQUEST' : 'INVALID_PAYMENT_REQUEST', details: error.issues.map((issue) => issue.path.join('.')) });
  if (error instanceof RegisterUserError) return response.status(error.message === 'EMAIL_ALREADY_REGISTERED' ? 409 : 400).json({ error: error.message });
  if (error instanceof AccountLockedError) {
    metrics.authLockoutsTotal.inc();
    const retryAfterSeconds = Math.ceil(error.retryAfterMs / 1000);
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : undefined;
    audit.write({ event: 'auth.lockout', metadata: { email: email ?? 'unknown', retry_after_s: retryAfterSeconds } });
    response.setHeader('Retry-After', String(retryAfterSeconds));
    return response.status(429).json({ error: 'ACCOUNT_LOCKED', retryAfterSeconds });
  }
  if (error instanceof LoginUserError) return response.status(401).json({ error: error.message });
  if (error instanceof PaymentRequestError) return response.status(error.message === 'BOOKING_NOT_FOUND' ? 404 : 400).json({ error: error.message });
  if (error instanceof IdempotencyConflictError) return response.status(409).json({ error: error.message });
  if (error instanceof PaymentVerificationError || error instanceof RefundPaymentError) return response.status(error.message === 'PAYMENT_NOT_FOUND' ? 404 : 409).json({ error: error.message });
  if (error instanceof ChatAssistantError) return response.status(error.message === 'CHAT_NOT_CONFIGURED' ? 503 : 502).json({ error: 'CHAT_UNAVAILABLE' });
  console.error(error);
  return response.status(500).json({ error: 'INTERNAL_ERROR' });
});

app.listen(port, () => console.info(`payment-api listening on http://127.0.0.1:${port}`));
