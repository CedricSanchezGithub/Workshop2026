import type { PaymentIntent, PaymentStatus } from '../../domain/payment/PaymentIntent.js';

export interface PaymentRepository {
  findById(id: string): Promise<PaymentIntent | undefined>;
  list(): Promise<PaymentIntent[]>;
  findByIdempotencyKey(userId: string, idempotencyKey: string): Promise<PaymentIntent | undefined>;
  save(payment: PaymentIntent): Promise<void>;
  updateStatus(id: string, status: PaymentStatus, changes?: Partial<PaymentIntent>): Promise<PaymentIntent>;
}
