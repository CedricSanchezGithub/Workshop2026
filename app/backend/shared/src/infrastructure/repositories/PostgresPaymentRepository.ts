import type { PaymentRepository } from '../../application/ports/PaymentRepository.js';
import type { PaymentIntent, PaymentStatus } from '../../domain/payment/PaymentIntent.js';
import { PostgresDatabase } from '../database/PostgresDatabase.js';
import { toPayment } from './PostgresMappers.js';

export class PostgresPaymentRepository implements PaymentRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async findById(id: string) {
    const result = await this.database.query('SELECT * FROM payment_intents WHERE id = $1', [id]);
    return result.rows[0] ? toPayment(result.rows[0]) : undefined;
  }

  async list() {
    const result = await this.database.query('SELECT * FROM payment_intents ORDER BY created_at DESC');
    return result.rows.map(toPayment);
  }

  async findByIdempotencyKey(userId: string, idempotencyKey: string) {
    const result = await this.database.query('SELECT * FROM payment_intents WHERE user_id = $1 AND idempotency_key = $2', [userId, idempotencyKey]);
    return result.rows[0] ? toPayment(result.rows[0]) : undefined;
  }

  async save(payment: PaymentIntent) {
    await this.database.query(
      `INSERT INTO payment_intents
        (id, user_id, booking_id, amount_cents, currency, status, idempotency_key, request_fingerprint,
         provider_reference, failure_code, payment_method_token, payment_method_last4, payment_method_brand,
         payer_email, verified_at, refund_reference, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [payment.id, payment.userId, payment.bookingId, payment.amountCents, payment.currency, payment.status, payment.idempotencyKey, payment.requestFingerprint, payment.providerReference ?? null, payment.failureCode ?? null, payment.paymentMethodToken, payment.paymentMethodLast4, payment.paymentMethodBrand, payment.payerEmail, payment.verifiedAt ?? null, payment.refundReference ?? null, payment.createdAt, payment.updatedAt],
    );
  }

  async updateStatus(id: string, status: PaymentStatus, changes: Partial<PaymentIntent> = {}) {
    const current = await this.findById(id);
    if (!current) throw new Error('PAYMENT_NOT_FOUND');
    const updated = { ...current, ...changes, status, updatedAt: new Date().toISOString() };
    const result = await this.database.query(
      `UPDATE payment_intents SET status=$2, provider_reference=$3, failure_code=$4,
        verified_at=$5, refund_reference=$6, updated_at=$7 WHERE id=$1 RETURNING *`,
      [id, updated.status, updated.providerReference ?? null, updated.failureCode ?? null, updated.verifiedAt ?? null, updated.refundReference ?? null, updated.updatedAt],
    );
    return toPayment(result.rows[0]);
  }
}
