import type { PaymentRepository } from '../../application/ports/PaymentRepository.js';
import type { PaymentIntent, PaymentStatus } from '../../domain/payment/PaymentIntent.js';

export class InMemoryPaymentRepository implements PaymentRepository {
  private readonly payments = new Map<string, PaymentIntent>();

  async findById(id: string) {
    return this.payments.get(id);
  }

  async list() {
    return [...this.payments.values()];
  }

  async findByIdempotencyKey(userId: string, idempotencyKey: string) {
    return [...this.payments.values()].find((payment) => payment.userId === userId && payment.idempotencyKey === idempotencyKey);
  }

  async save(payment: PaymentIntent) {
    this.payments.set(payment.id, payment);
  }

  async updateStatus(id: string, status: PaymentStatus, changes: Partial<PaymentIntent> = {}) {
    const payment = this.payments.get(id);
    if (!payment) throw new Error('PAYMENT_NOT_FOUND');
    const updated = { ...payment, ...changes, status, updatedAt: new Date().toISOString() };
    this.payments.set(id, updated);
    return updated;
  }
}
