import type { PaymentRepository } from '../ports/PaymentRepository.js';

export class GetPaymentIntent {
  constructor(private readonly repository: PaymentRepository) {}

  async execute(paymentId: string) {
    return this.repository.findById(paymentId);
  }
}
