import type { PaymentJob, PaymentQueue, QueueStatus } from '../../application/ports/PaymentQueue.js';
import { PostgresDatabase } from '../database/PostgresDatabase.js';

type QueuedJob = PaymentJob & { id: number };

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export class PostgresPaymentQueue implements PaymentQueue {
  constructor(private readonly database: PostgresDatabase, private readonly pollIntervalMs = Number(process.env.QUEUE_POLL_MS ?? 200)) {}

  async publish(job: PaymentJob) {
    await this.database.query('INSERT INTO payment_jobs (type, payment_id) VALUES ($1, $2)', [job.type, job.paymentId]);
  }

  subscribe(_handler: (job: PaymentJob) => Promise<void>) {
    return () => undefined;
  }

  scale(workerCount: number) {
    const bounded = Math.max(1, Math.min(10, Math.trunc(workerCount)));
    return this.database.query(
      `INSERT INTO queue_config (config_key, worker_count) VALUES ('payments', $1)
       ON CONFLICT (config_key) DO UPDATE SET worker_count = EXCLUDED.worker_count`,
      [bounded],
    ).then(() => this.getStatus());
  }

  async getStatus(): Promise<QueueStatus> {
    const result = await this.database.query<{ depth: string; active_workers: string; worker_count: string }>(
      `SELECT
        (SELECT COUNT(*) FROM payment_jobs WHERE status = 'pending')::text AS depth,
        (SELECT COUNT(*) FROM payment_jobs WHERE status = 'processing')::text AS active_workers,
        (SELECT worker_count FROM queue_config WHERE config_key = 'payments')::text AS worker_count`,
    );
    const row = result.rows[0];
    return { depth: Number(row?.depth ?? 0), activeWorkers: Number(row?.active_workers ?? 0), workerCount: Number(row?.worker_count ?? 1) };
  }

  consume(handler: (job: PaymentJob) => Promise<void>) {
    let stopped = false;
    const loops = Array.from({ length: 10 }, (_, slot) => this.runWorker(slot, handler, () => stopped));
    void Promise.all(loops);
    return () => { stopped = true; };
  }

  private async runWorker(slot: number, handler: (job: PaymentJob) => Promise<void>, isStopped: () => boolean) {
    while (!isStopped()) {
      const status = await this.getStatus();
      if (slot >= status.workerCount) {
        await sleep(this.pollIntervalMs);
        continue;
      }
      const job = await this.claim();
      if (!job) {
        await sleep(this.pollIntervalMs);
        continue;
      }
      try {
        await handler(job);
        await this.database.query('UPDATE payment_jobs SET status = \'completed\', completed_at = NOW() WHERE id = $1', [job.id]);
      } catch (error) {
        await this.database.query(`UPDATE payment_jobs SET status = CASE WHEN attempts >= 3 THEN 'failed' ELSE 'pending' END,
          available_at = NOW() + INTERVAL '2 seconds', last_error = $2 WHERE id = $1`, [job.id, error instanceof Error ? error.message : 'UNKNOWN_ERROR']);
      }
    }
  }

  private async claim(): Promise<QueuedJob | undefined> {
    return this.database.transaction(async (client) => {
      const result = await client.query('SELECT id, type, payment_id FROM payment_jobs WHERE status = \'pending\' AND available_at <= NOW() ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1');
      const row = result.rows[0];
      if (!row) return undefined;
      await client.query('UPDATE payment_jobs SET status = \'processing\', attempts = attempts + 1, locked_at = NOW() WHERE id = $1', [row.id]);
      return { id: Number(row.id), type: String(row.type) as PaymentJob['type'], paymentId: String(row.payment_id) };
    });
  }
}
