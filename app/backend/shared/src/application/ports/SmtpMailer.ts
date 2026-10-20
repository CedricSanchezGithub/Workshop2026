export type VerificationEmail = { messageId: string; demoCode: string };

export interface SmtpMailer {
  sendPaymentVerification(input: { paymentId: string; recipient: string }): Promise<VerificationEmail>;
  verifyPaymentCode(paymentId: string, code: string): boolean;
}
