import type { PaymentIntent } from '../../domain/payment/PaymentIntent.js';

export type GatewayResult = { approved: true; providerReference: string } | { approved: false; failureCode: string };

export interface PaymentGateway {
  charge(payment: PaymentIntent): Promise<GatewayResult>;
  refund(payment: PaymentIntent): Promise<{ refunded: true; refundReference: string }>;
}
