export type PaymentStatus = 'awaiting_verification' | 'pending' | 'processing' | 'succeeded' | 'failed' | 'refund_pending' | 'refunded';

export type PaymentIntent = {
  id: string;
  userId: string;
  bookingId: string;
  amountCents: number;
  currency: 'EUR';
  status: PaymentStatus;
  idempotencyKey: string;
  requestFingerprint: string;
  providerReference?: string;
  failureCode?: string;
  paymentMethodToken: string;
  paymentMethodLast4: string;
  paymentMethodBrand: 'visa' | 'mastercard' | 'amex' | 'other';
  payerEmail: string;
  verifiedAt?: string;
  refundReference?: string;
  createdAt: string;
  updatedAt: string;
};
