import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

test('structure clean architecture: les couches et adaptateurs essentiels sont présents', () => {
  const requiredFiles = [
    'backend/shared/src/domain/auth/User.ts',
    'backend/shared/src/domain/payment/PaymentIntent.ts',
    'backend/shared/src/application/ports/UserRepository.ts',
    'backend/shared/src/application/ports/SessionRepository.ts',
    'backend/shared/src/application/ports/BookingQuoteRepository.ts',
    'backend/shared/src/application/mappers/PaymentView.ts',
    'backend/shared/src/application/use-cases/RegisterUser.ts',
    'backend/shared/src/application/use-cases/LoginUser.ts',
    'backend/shared/src/application/use-cases/CreatePaymentIntent.ts',
    'backend/shared/src/infrastructure/repositories/InMemoryUserRepository.ts',
    'backend/shared/src/infrastructure/repositories/InMemorySessionRepository.ts',
    'backend/shared/src/infrastructure/repositories/InMemoryBookingQuoteRepository.ts',
    'backend/shared/src/infrastructure/repositories/PostgresPaymentRepository.ts',
    'backend/shared/src/infrastructure/repositories/PostgresUserRepository.ts',
    'backend/shared/src/infrastructure/repositories/PostgresSessionRepository.ts',
    'backend/shared/src/infrastructure/repositories/PostgresBookingQuoteRepository.ts',
    'backend/shared/src/infrastructure/queue/PostgresPaymentQueue.ts',
    'backend/shared/src/infrastructure/database/PostgresDatabase.ts',
    'backend/services/payment-worker/src/main.ts',
    'backend/shared/src/infrastructure/avatars/JdenticonAvatarGenerator.ts',
    'backend/shared/src/infrastructure/security/ScryptPasswordHasher.ts',
    'backend/api/src/docs/openapi.ts',
    'backend/api/src/observability/Metrics.ts',
    'backend/shared/src/application/chat/ChatTopicGuard.ts',
    'backend/shared/src/application/ports/ChatAssistant.ts',
    'backend/shared/src/infrastructure/chat/OpenAIChatAssistant.ts',
    'docs/ARCHITECTURE.md',
    'docs/CHATBOT_ARCHITECTURE.md',
    'front/src/features/admin/AdminPage.jsx',
    'front/src/features/admin/adminClient.js',
    'front/src/features/auth/authClient.js',
    'front/src/features/payment/paymentClient.js',
    'front/src/features/chat/chatClient.js',
    'infra/database/init/001_schema.sql',
    'infra/docker-compose.yml',
    'infra/docker/Dockerfile.api',
    'infra/docker/Dockerfile.web',
  ];
  for (const file of requiredFiles) assert.equal(existsSync(join(root, file)), true, `${file} doit exister`);
});

test('documentation API et architecture sont publiées', () => {
  const openapiSource = readFileSync(join(root, 'backend/api/src/docs/openapi.ts'), 'utf8');
  const architectureSource = readFileSync(join(root, 'docs/ARCHITECTURE.md'), 'utf8');
  const apiSource = readFileSync(join(root, 'backend/api/src/main.ts'), 'utf8');
  assert.match(openapiSource, /openapi:\s*'3\.0\.3'/);
  assert.match(openapiSource, /\/v1\/chat/);
  assert.match(apiSource, /\/docs/);
  assert.match(apiSource, /\/openapi\.json/);
  assert.match(apiSource, /\/metrics/);
  assert.match(apiSource, /event: 'http'/);
  assert.match(apiSource, /return 'unmatched'/);
  assert.match(architectureSource, /```mermaid/);
});

test('déploiement payment séparé et queue interchangeable sont déclarés', () => {
  const compose = readFileSync(join(root, 'infra/docker-compose.yml'), 'utf8');
  const schema = readFileSync(join(root, 'infra/database/init/001_schema.sql'), 'utf8');
  const mainSource = readFileSync(join(root, 'backend/api/src/main.ts'), 'utf8');
  assert.match(compose, /payment-api/);
  assert.match(compose, /payment-worker/);
  assert.match(compose, /postgres:/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS payment_jobs/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS payment_intents/);
  assert.match(schema, /avatar_svg TEXT NOT NULL CHECK \(avatar_svg LIKE '<svg%'\)/);
  assert.match(mainSource, /STORAGE_DRIVER === 'postgres'/);
  assert.match(mainSource, /QUEUE_DRIVER === 'postgres'/);
  assert.match(mainSource, /\/v1\/chat/);
});

test('structure clean architecture: le domaine ne dépend pas de l’infrastructure', () => {
  const domainFiles = ['backend/shared/src/domain/auth/User.ts', 'backend/shared/src/domain/payment/PaymentIntent.ts'];
  for (const file of domainFiles) {
    const source = readFileSync(join(root, file), 'utf8');
    assert.doesNotMatch(source, /infrastructure|express|jdenticon|node:crypto/);
  }
});
