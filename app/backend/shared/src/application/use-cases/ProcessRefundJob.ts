import type { AuditLogger } from '../ports/AuditLogger.js';
import type { PaymentGateway } from '../ports/PaymentGateway.js';
import type { PaymentRepository } from '../ports/PaymentRepository.js';

export class ProcessRefundJob {
  constructor(private readonly repository: PaymentRepository, private readonly gateway: PaymentGateway, private readonly audit: AuditLogger) {}

  async execute(paymentId: string) {
    const payment = await this.repository.findById(paymentId);
    if (!payment || payment.status === 'refunded') return payment;
    try {
      const result = await this.gateway.refund(payment);
      const refunded = await this.repository.updateStatus(paymentId, 'refunded', { refundReference: result.refundReference });
      this.audit.write({ event: 'payment.refund.succeeded', paymentId, userId: refunded.userId });
      return refunded;
    } catch {
      const failed = await this.repository.updateStatus(paymentId, 'succeeded', { failureCode: 'REFUND_GATEWAY_UNAVAILABLE' });
      this.audit.write({ event: 'payment.refund.failed', paymentId, userId: failed.userId });
      return failed;
    }
  }
}
