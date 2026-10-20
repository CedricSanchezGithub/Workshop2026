import type { AuditLogger } from '../ports/AuditLogger.js';
import type { PaymentQueue } from '../ports/PaymentQueue.js';
import type { PaymentRepository } from '../ports/PaymentRepository.js';

export class RefundPaymentError extends Error {
  constructor(message: 'PAYMENT_NOT_FOUND' | 'PAYMENT_NOT_REFUNDABLE') {
    super(message);
  }
}

export class RefundPayment {
  constructor(private readonly repository: PaymentRepository, private readonly queue: PaymentQueue, private readonly audit: AuditLogger) {}

  async execute(paymentId: string) {
    const payment = await this.repository.findById(paymentId);
    if (!payment) throw new RefundPaymentError('PAYMENT_NOT_FOUND');
    if (payment.status === 'refunded' || payment.status === 'refund_pending') return payment;
    if (payment.status !== 'succeeded') throw new RefundPaymentError('PAYMENT_NOT_REFUNDABLE');
    const pending = await this.repository.updateStatus(paymentId, 'refund_pending');
    this.audit.write({ event: 'payment.refund.requested', paymentId, userId: pending.userId });
    await this.queue.publish({ type: 'payment.refund', paymentId });
    return pending;
  }
}
