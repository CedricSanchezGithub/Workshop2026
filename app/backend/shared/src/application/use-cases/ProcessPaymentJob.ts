import type { AuditLogger } from '../ports/AuditLogger.js';
import type { PaymentGateway } from '../ports/PaymentGateway.js';
import type { PaymentRepository } from '../ports/PaymentRepository.js';

export class ProcessPaymentJob {
  constructor(private readonly repository: PaymentRepository, private readonly gateway: PaymentGateway, private readonly audit: AuditLogger) {}

  async execute(paymentId: string) {
    const payment = await this.repository.findById(paymentId);
    if (!payment || payment.status === 'succeeded') return;
    await this.repository.updateStatus(paymentId, 'processing');
    this.audit.write({ event: 'payment.processing.started', paymentId, userId: payment.userId });
    try {
      const result = await this.gateway.charge(payment);
      if (!result.approved) {
        const failed = await this.repository.updateStatus(paymentId, 'failed', { failureCode: result.failureCode });
        this.audit.write({ event: 'payment.failed', paymentId, userId: failed.userId, metadata: { reason: result.failureCode } });
        return failed;
      }
      const succeeded = await this.repository.updateStatus(paymentId, 'succeeded', { providerReference: result.providerReference });
      this.audit.write({ event: 'payment.succeeded', paymentId, userId: succeeded.userId });
      return succeeded;
    } catch {
      const failed = await this.repository.updateStatus(paymentId, 'failed', { failureCode: 'GATEWAY_UNAVAILABLE' });
      this.audit.write({ event: 'payment.failed', paymentId, userId: failed.userId, metadata: { reason: 'GATEWAY_UNAVAILABLE' } });
      return failed;
    }
  }
}
