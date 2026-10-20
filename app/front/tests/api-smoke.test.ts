import { test } from 'node:test';
import assert from 'node:assert/strict';

const apiUrl = (process.env.PAYANDGO_API_URL ?? 'http://127.0.0.1:4400').replace(/\/$/, '');
const frontUrl = (process.env.PAYANDGO_FRONT_URL ?? 'http://127.0.0.1:5500').replace(/\/$/, '');
const frontOrigin = new URL(frontUrl).origin;

async function getAvailable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
    return response.status < 500;
  } catch {
    return false;
  }
}

async function jsonRequest(path: string, init?: RequestInit) {
  const response = await fetch(`${apiUrl}${path}`, init);
  const body = await response.json().catch(() => undefined);
  return { response, body };
}

async function waitForPaymentStatus(token: string, paymentId: string, expected: string) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  const payment = await jsonRequest(`/v1/payments/${paymentId}`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(payment.response.status, 200);
  assert.equal(payment.body?.data?.status, expected);
  return payment.body.data;
}

test('smoke API : santé, OpenAPI, métriques et CORS', async (context) => {
  if (!(await getAvailable(`${apiUrl}/health`))) return context.skip(`API indisponible sur ${apiUrl}`);

  const health = await jsonRequest('/health');
  assert.equal(health.response.status, 200);
  assert.deepEqual(health.body, { status: 'ok', service: 'payment-api' });

  const openapi = await jsonRequest('/openapi.json');
  assert.equal(openapi.response.status, 200);
  assert.equal(openapi.body.paths['/metrics'].get.responses['200'].description, 'Métriques au format Prometheus');
  assert.ok(openapi.body.paths['/v1/payments/intents']);

  const docs = await fetch(`${apiUrl}/docs/`);
  assert.equal(docs.status, 200);
  assert.match(await docs.text(), /swagger/i);

  const metricsBefore = await fetch(`${apiUrl}/metrics`);
  const metricsBeforeText = await metricsBefore.text();
  assert.equal(metricsBefore.status, 200);
  assert.match(metricsBefore.headers.get('content-type') ?? '', /text\/plain/);
  assert.match(metricsBeforeText, /http_requests_total/);
  assert.match(metricsBeforeText, /payments_total\{status="accepted"\}/);
  assert.doesNotMatch(metricsBeforeText, /route="\/metrics"/);

  const metricsAfter = await fetch(`${apiUrl}/metrics`);
  const metricsAfterText = await metricsAfter.text();
  assert.doesNotMatch(metricsAfterText, /route="\/metrics"/);

  const cors = await fetch(`${apiUrl}/v1/auth/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: frontOrigin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
  assert.ok(cors.status < 300);
  assert.equal(cors.headers.get('access-control-allow-origin'), frontOrigin);
});

test('smoke API : inscription, session, droits admin et déconnexion', async (context) => {
  if (!(await getAvailable(`${apiUrl}/health`))) return context.skip(`API indisponible sur ${apiUrl}`);

  const email = `smoke_${Date.now()}@example.test`;
  const password = 'PayGo!123';
  const registered = await jsonRequest('/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Smoke Test', email, password }),
  });
  assert.equal(registered.response.status, 201);
  assert.ok(registered.body.data.token);
  const token = registered.body.data.token as string;
  const authorization = { Authorization: `Bearer ${token}` };

  const me = await jsonRequest('/v1/auth/me', { headers: authorization });
  assert.equal(me.response.status, 200);
  assert.equal(me.body.data.email, email);
  assert.equal(me.body.data.role, 'user');
  assert.equal(me.body.data.avatarSvg.startsWith('<svg'), true);

  const admin = await jsonRequest('/v1/admin/overview', { headers: authorization });
  assert.equal(admin.response.status, 403);
  assert.equal(admin.body.error, 'ADMIN_REQUIRED');

  const failedLogin = await jsonRequest('/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'wrong-password' }),
  });
  assert.equal(failedLogin.response.status, 401);
  assert.equal(failedLogin.body.error, 'INVALID_CREDENTIALS');

  const invalidPayment = await jsonRequest('/v1/payments/intents', {
    method: 'POST',
    headers: { ...authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(invalidPayment.response.status, 400);
  assert.equal(invalidPayment.body.error, 'INVALID_IDEMPOTENCY_KEY');

  const logout = await jsonRequest('/v1/auth/logout', { method: 'POST', headers: authorization });
  assert.equal(logout.response.status, 200);
  const afterLogout = await jsonRequest('/v1/auth/me', { headers: authorization });
  assert.equal(afterLogout.response.status, 401);

  const login = await jsonRequest('/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.response.status, 200);
  const loggedInToken = login.body.data.token as string;
  assert.ok(loggedInToken);

  const createdPayment = await jsonRequest('/v1/payments/intents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${loggedInToken}`, 'Content-Type': 'application/json', 'Idempotency-Key': `smoke-${Date.now()}-payment` },
    body: JSON.stringify({ bookingId: 'booking_1', amountCents: 3900, currency: 'EUR', paymentMethod: { token: 'pm_mock_smoke-1234567', last4: '4242', brand: 'visa', email } }),
  });
  assert.equal(createdPayment.response.status, 202);
  assert.equal(createdPayment.body.data.status, 'awaiting_verification');
  const paymentId = createdPayment.body.data.id as string;

  const verifiedPayment = await jsonRequest(`/v1/payments/${paymentId}/verify`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${loggedInToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: '123456' }),
  });
  assert.equal(verifiedPayment.response.status, 202);
  await waitForPaymentStatus(loggedInToken, paymentId, 'succeeded');

  const refund = await jsonRequest(`/v1/payments/${paymentId}/refund`, { method: 'POST', headers: { Authorization: `Bearer ${loggedInToken}` } });
  assert.equal(refund.response.status, 202);
  await waitForPaymentStatus(loggedInToken, paymentId, 'refunded');

  const finalLogout = await jsonRequest('/v1/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${loggedInToken}` } });
  assert.equal(finalLogout.response.status, 200);
});

test('smoke frontend : les routes d’entrée servent l’application', async (context) => {
  if (!(await getAvailable(`${frontUrl}/`))) return context.skip(`Frontend indisponible sur ${frontUrl}`);

  for (const path of ['/', '/app']) {
    const response = await fetch(`${frontUrl}${path}`);
    const html = await response.text();
    assert.equal(response.status, 200, `${path} doit répondre 200`);
    assert.match(html, /<div id="root"><\/div>/);
    assert.match(html, /<script type="module"/);
  }
});
