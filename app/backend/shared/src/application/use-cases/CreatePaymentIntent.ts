import { createHash, randomUUID } from 'node:crypto';
import type { AuditLogger } from '../ports/AuditLogger.js';
import type { PaymentRepository } from '../ports/PaymentRepository.js';
import type { SmtpMailer } from '../ports/SmtpMailer.js';
import type { BookingQuoteRepository } from '../ports/BookingQuoteRepository.js';
import type { PaymentIntent } from '../../domain/payment/PaymentIntent.js';

export type CreatePaymentCommand = {
  userId: string;
  bookingId: string;
  amountCents: number;
  currency: 'EUR';
  idempotencyKey: string;
  paymentMethodToken: string;
  paymentMethodLast4: string;
  paymentMethodBrand: 'visa' | 'mastercard' | 'amex' | 'other';
  payerEmail: string;
};

export class IdempotencyConflictError extends Error {
  constructor() {
    super('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST');
  }
}

export class PaymentRequestError extends Error {
  constructor(message: 'BOOKING_NOT_FOUND' | 'AMOUNT_MISMATCH' | 'INVALID_PAYMENT_METHOD') {
    super(message);
  }
}

export class CreatePaymentIntent {
  constructor(private readonly repository: PaymentRepository, private readonly audit: AuditLogger, private readonly mailer: SmtpMailer, private readonly quotes: BookingQuoteRepository) {}

  async execute(command: CreatePaymentCommand) {
    const requestFingerprint = createHash('sha256').update(JSON.stringify({ bookingId: command.bookingId, amountCents: command.amountCents, currency: command.currency, paymentMethodToken: command.paymentMethodToken })).digest('hex');
    const previous = await this.repository.findByIdempotencyKey(command.userId, command.idempotencyKey);
    if (previous) {
      if (previous.requestFingerprint !== requestFingerprint) throw new IdempotencyConflictError();
      return { payment: previous, reused: true, verification: previous.status === 'awaiting_verification' ? { channel: 'smtp', demoCode: process.env.DEMO_PAYMENT_CODE ?? '123456' } : undefined };
    }
    const quote = await this.quotes.findByBookingId(command.bookingId);
    if (!quote) throw new PaymentRequestError('BOOKING_NOT_FOUND');
    if (quote.amountCents !== command.amountCents || quote.currency !== command.currency) throw new PaymentRequestError('AMOUNT_MISMATCH');
    if (!/^pm_mock_[a-z0-9-]{12,128}$/.test(command.paymentMethodToken) || !/^\d{4}$/.test(command.paymentMethodLast4) || !['visa', 'mastercard', 'amex', 'other'].includes(command.paymentMethodBrand) || !/^\S+@\S+\.\S+$/.test(command.payerEmail)) throw new PaymentRequestError('INVALID_PAYMENT_METHOD');

    const now = new Date().toISOString();
    const payment: PaymentIntent = { id: `pi_${randomUUID()}`, userId: command.userId, bookingId: command.bookingId, amountCents: command.amountCents, currency: command.currency, status: 'awaiting_verification', idempotencyKey: command.idempotencyKey, requestFingerprint, paymentMethodToken: command.paymentMethodToken, paymentMethodLast4: command.paymentMethodLast4, paymentMethodBrand: command.paymentMethodBrand, payerEmail: command.payerEmail, createdAt: now, updatedAt: now };
    try {
      await this.repository.save(payment);
    } catch (error) {
      // The database unique constraint is the final arbiter for concurrent retries.
      // Re-read the intent so a race remains idempotent instead of becoming a 500.
      const concurrent = await this.repository.findByIdempotencyKey(command.userId, command.idempotencyKey);
      if (concurrent) {
        if (concurrent.requestFingerprint !== requestFingerprint) throw new IdempotencyConflictError();
        return { payment: concurrent, reused: true, verification: concurrent.status === 'awaiting_verification' ? { channel: 'smtp', demoCode: process.env.DEMO_PAYMENT_CODE ?? '123456' } : undefined };
      }
      throw error;
    }
    this.audit.write({ event: 'payment.intent.created', paymentId: payment.id, userId: payment.userId, metadata: { amountCents: payment.amountCents, currency: payment.currency } });
    const verification = await this.mailer.sendPaymentVerification({ paymentId: payment.id, recipient: payment.payerEmail });
    return { payment, reused: false, verification: { channel: 'smtp', demoCode: verification.demoCode } };
  }
}
