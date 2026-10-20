import type { User } from '../../domain/auth/User.js';
import type { PaymentIntent, PaymentStatus } from '../../domain/payment/PaymentIntent.js';

export function toUser(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    role: row.role === 'admin' ? 'admin' : 'user',
    passwordHash: String(row.password_hash),
    avatarSvg: String(row.avatar_svg),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export function toPayment(row: Record<string, unknown>): PaymentIntent {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    bookingId: String(row.booking_id),
    amountCents: Number(row.amount_cents),
    currency: 'EUR',
    status: String(row.status) as PaymentStatus,
    idempotencyKey: String(row.idempotency_key),
    requestFingerprint: String(row.request_fingerprint),
    providerReference: row.provider_reference ? String(row.provider_reference) : undefined,
    failureCode: row.failure_code ? String(row.failure_code) : undefined,
    paymentMethodToken: String(row.payment_method_token),
    paymentMethodLast4: String(row.payment_method_last4),
    paymentMethodBrand: String(row.payment_method_brand) as PaymentIntent['paymentMethodBrand'],
    payerEmail: String(row.payer_email),
    verifiedAt: row.verified_at ? new Date(String(row.verified_at)).toISOString() : undefined,
    refundReference: row.refund_reference ? String(row.refund_reference) : undefined,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}
