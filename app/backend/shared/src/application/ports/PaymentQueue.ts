export type PaymentJob = { type: 'payment.process' | 'payment.refund'; paymentId: string };
export type QueueStatus = { depth: number; workerCount: number; activeWorkers: number };

export interface PaymentQueue {
  publish(job: PaymentJob): Promise<void>;
  subscribe(handler: (job: PaymentJob) => Promise<void>): () => void;
  consume?(handler: (job: PaymentJob) => Promise<void>): () => void;
  scale(workerCount: number): QueueStatus | Promise<QueueStatus>;
  getStatus(): QueueStatus | Promise<QueueStatus>;
}
