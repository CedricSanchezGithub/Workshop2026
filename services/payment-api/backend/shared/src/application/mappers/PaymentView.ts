import type { PaymentIntent } from '../../domain/payment/PaymentIntent.js';

export type PaymentView = Omit<PaymentIntent, 'userId' | 'idempotencyKey' | 'requestFingerprint' | 'paymentMethodToken' | 'payerEmail'>;

export function toPaymentView(payment: PaymentIntent): PaymentView {
  const { userId: _userId, idempotencyKey: _idempotencyKey, requestFingerprint: _requestFingerprint, paymentMethodToken: _paymentMethodToken, payerEmail: _payerEmail, ...safePayment } = payment;
  return safePayment;
}
