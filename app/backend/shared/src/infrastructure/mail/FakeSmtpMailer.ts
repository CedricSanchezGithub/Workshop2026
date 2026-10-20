import { createHash, randomUUID } from 'node:crypto';
import type { SmtpMailer, VerificationEmail } from '../../application/ports/SmtpMailer.js';

export class FakeSmtpMailer implements SmtpMailer {
  private readonly codes = new Map<string, string>();
  private readonly demoCode = process.env.DEMO_PAYMENT_CODE ?? '123456';

  async sendPaymentVerification(input: { paymentId: string; recipient: string }): Promise<VerificationEmail> {
    this.codes.set(input.paymentId, this.demoCode);
    console.info(JSON.stringify({ event: 'smtp.payment.verification.sent', messageId: `smtp_${randomUUID()}`, paymentId: input.paymentId, recipientHash: createHash('sha256').update(input.recipient).digest('hex').slice(0, 12), demoCode: this.demoCode }));
    return { messageId: `smtp_${randomUUID()}`, demoCode: this.demoCode };
  }

  verifyPaymentCode(paymentId: string, code: string) {
    const expected = this.codes.get(paymentId);
    return Boolean(expected && code === expected);
  }
}
