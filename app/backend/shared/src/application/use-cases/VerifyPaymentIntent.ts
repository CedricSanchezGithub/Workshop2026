import type { AuditLogger } from '../ports/AuditLogger.js';
import type { PaymentQueue } from '../ports/PaymentQueue.js';
import type { PaymentRepository } from '../ports/PaymentRepository.js';
import type { SmtpMailer } from '../ports/SmtpMailer.js';

export class PaymentVerificationError extends Error {
  constructor(message: 'PAYMENT_NOT_FOUND' | 'PAYMENT_ALREADY_VERIFIED' | 'INVALID_PAYMENT_CODE') {
    super(message);
  }
}

export class VerifyPaymentIntent {
  constructor(private readonly repository: PaymentRepository, private readonly queue: PaymentQueue, private readonly audit: AuditLogger, private readonly mailer: SmtpMailer) {}

  async execute(paymentId: string, code: string) {
    const payment = await this.repository.findById(paymentId);
    if (!payment) throw new PaymentVerificationError('PAYMENT_NOT_FOUND');
    if (payment.status !== 'awaiting_verification') {
      if (payment.status === 'pending' || payment.status === 'processing' || payment.status === 'succeeded') return payment;
      throw new PaymentVerificationError('PAYMENT_ALREADY_VERIFIED');
    }
    if (!this.mailer.verifyPaymentCode(paymentId, code)) throw new PaymentVerificationError('INVALID_PAYMENT_CODE');
    const verified = await this.repository.updateStatus(paymentId, 'pending', { verifiedAt: new Date().toISOString() });
    this.audit.write({ event: 'payment.verification.succeeded', paymentId, userId: verified.userId });
    await this.queue.publish({ type: 'payment.process', paymentId });
    return verified;
  }
}
