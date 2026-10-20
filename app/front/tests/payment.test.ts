import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CreatePaymentIntent, IdempotencyConflictError } from '../../backend/shared/src/application/use-cases/CreatePaymentIntent.js';
import { ProcessPaymentJob } from '../../backend/shared/src/application/use-cases/ProcessPaymentJob.js';
import { ProcessRefundJob } from '../../backend/shared/src/application/use-cases/ProcessRefundJob.js';
import { RefundPayment } from '../../backend/shared/src/application/use-cases/RefundPayment.js';
import { VerifyPaymentIntent, PaymentVerificationError } from '../../backend/shared/src/application/use-cases/VerifyPaymentIntent.js';
import { InMemoryPaymentQueue } from '../../backend/shared/src/infrastructure/queue/InMemoryPaymentQueue.js';
import { MockPaymentGateway } from '../../backend/shared/src/infrastructure/gateways/MockPaymentGateway.js';
import { FakeSmtpMailer } from '../../backend/shared/src/infrastructure/mail/FakeSmtpMailer.js';
import { InMemoryPaymentRepository } from '../../backend/shared/src/infrastructure/repositories/InMemoryPaymentRepository.js';
import { InMemoryBookingQuoteRepository } from '../../backend/shared/src/infrastructure/repositories/InMemoryBookingQuoteRepository.js';
import { toPaymentView } from '../../backend/shared/src/application/mappers/PaymentView.js';
import type { AuditEvent, AuditLogger } from '../../backend/shared/src/application/ports/AuditLogger.js';

class TestAuditLogger implements AuditLogger {
  readonly events: AuditEvent[] = [];
  write(event: AuditEvent) { this.events.push(event); }
}

test('paiement: idempotence, vérification SMTP, queue et remboursement', async () => {
  const repository = new InMemoryPaymentRepository();
  const queue = new InMemoryPaymentQueue();
  const audit = new TestAuditLogger();
  const mailer = new FakeSmtpMailer();
  const gateway = new MockPaymentGateway();
  const processPayment = new ProcessPaymentJob(repository, gateway, audit);
  const processRefund = new ProcessRefundJob(repository, gateway, audit);
  assert.equal(queue.scale(3).workerCount, 3);
  assert.equal(queue.scale(99).workerCount, 10);
  queue.subscribe(async (job) => job.type === 'payment.process' ? processPayment.execute(job.paymentId).then(() => undefined) : processRefund.execute(job.paymentId).then(() => undefined));

  const create = new CreatePaymentIntent(repository, audit, mailer, new InMemoryBookingQuoteRepository());
  const verify = new VerifyPaymentIntent(repository, queue, audit, mailer);
  const refund = new RefundPayment(repository, queue, audit);
  const command = { userId: 'usr_test', bookingId: 'booking_1', amountCents: 3900, currency: 'EUR' as const, idempotencyKey: 'idempotency-test-1234', paymentMethodToken: 'pm_mock_test-1234567', paymentMethodLast4: '4242', paymentMethodBrand: 'visa' as const, payerEmail: 'test@example.test' };

  const first = await create.execute(command);
  assert.equal(first.payment.status, 'awaiting_verification');
  assert.equal(first.verification?.demoCode, '123456');
  assert.equal('paymentMethodToken' in toPaymentView(first.payment), false);
  const replay = await create.execute(command);
  assert.equal(replay.reused, true);
  assert.equal(replay.payment.id, first.payment.id);
  await assert.rejects(() => create.execute({ ...command, amountCents: 4000 }), (error: unknown) => error instanceof IdempotencyConflictError);
  await assert.rejects(() => create.execute({ ...command, idempotencyKey: 'idempotency-test-5678', amountCents: 1 }), (error: unknown) => error instanceof Error && error.message === 'AMOUNT_MISMATCH');
  await assert.rejects(() => verify.execute(first.payment.id, '000000'), (error: unknown) => error instanceof PaymentVerificationError && error.message === 'INVALID_PAYMENT_CODE');

  const pending = await verify.execute(first.payment.id, '123456');
  assert.equal(pending.status, 'pending');
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal((await repository.findById(first.payment.id))?.status, 'succeeded');

  const refundPending = await refund.execute(first.payment.id);
  assert.equal(refundPending.status, 'refund_pending');
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal((await repository.findById(first.payment.id))?.status, 'refunded');
  assert.ok(audit.events.some((event) => event.event === 'payment.succeeded'));
  assert.ok(audit.events.some((event) => event.event === 'payment.refund.succeeded'));
});
