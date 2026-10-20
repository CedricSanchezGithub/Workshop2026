import type { PaymentJob, PaymentQueue, QueueStatus } from '../../application/ports/PaymentQueue.js';

export class InMemoryPaymentQueue implements PaymentQueue {
  private readonly jobs: PaymentJob[] = [];
  private readonly subscribers = new Set<(job: PaymentJob) => Promise<void>>();
  private workerCount = 1;
  private activeWorkers = 0;

  async publish(job: PaymentJob) {
    this.jobs.push(job);
    void this.drain();
  }

  scale(workerCount: number): QueueStatus {
    this.workerCount = Math.max(1, Math.min(10, Math.trunc(workerCount)));
    void this.drain();
    return this.getStatus();
  }

  getStatus() {
    return { depth: this.jobs.length, workerCount: this.workerCount, activeWorkers: this.activeWorkers };
  }

  subscribe(handler: (job: PaymentJob) => Promise<void>) {
    this.subscribers.add(handler);
    return () => this.subscribers.delete(handler);
  }

  private async drain() {
    while (this.activeWorkers < this.workerCount && this.jobs.length) {
      const job = this.jobs.shift();
      if (!job) continue;
      this.activeWorkers += 1;
      void this.process(job).finally(() => { this.activeWorkers -= 1; void this.drain(); });
    }
  }

  private async process(job: PaymentJob) {
    for (const subscriber of this.subscribers) await subscriber(job);
  }
}
