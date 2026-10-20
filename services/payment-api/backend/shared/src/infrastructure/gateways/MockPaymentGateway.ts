import { randomUUID } from 'node:crypto';
import type { PaymentGateway, GatewayResult } from '../../application/ports/PaymentGateway.js';
import type { PaymentIntent } from '../../domain/payment/PaymentIntent.js';

export class MockPaymentGateway implements PaymentGateway {
  async charge(payment: PaymentIntent): Promise<GatewayResult> {
    await new Promise((resolve) => setTimeout(resolve, 80));
    return { approved: true, providerReference: `mock_${payment.id}_${randomUUID().slice(0, 8)}` };
  }

  async refund(payment: PaymentIntent) {
    await new Promise((resolve) => setTimeout(resolve, 80));
    return { refunded: true as const, refundReference: `mock_refund_${payment.id}_${randomUUID().slice(0, 8)}` };
  }
}
