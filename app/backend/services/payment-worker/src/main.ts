import { ProcessPaymentJob } from '../../../shared/src/application/use-cases/ProcessPaymentJob.js';
import { ProcessRefundJob } from '../../../shared/src/application/use-cases/ProcessRefundJob.js';
import { PostgresDatabase } from '../../../shared/src/infrastructure/database/PostgresDatabase.js';
import { MockPaymentGateway } from '../../../shared/src/infrastructure/gateways/MockPaymentGateway.js';
import { ConsoleAuditLogger } from '../../../shared/src/infrastructure/logging/ConsoleAuditLogger.js';
import { PostgresPaymentRepository } from '../../../shared/src/infrastructure/repositories/PostgresPaymentRepository.js';
import { PostgresPaymentQueue } from '../../../shared/src/infrastructure/queue/PostgresPaymentQueue.js';

if (process.env.QUEUE_DRIVER !== 'postgres') {
  throw new Error('The payment worker requires QUEUE_DRIVER=postgres');
}

const database = new PostgresDatabase();
const repository = new PostgresPaymentRepository(database);
const queue = new PostgresPaymentQueue(database);
const gateway = new MockPaymentGateway();
const audit = new ConsoleAuditLogger();
const processPayment = new ProcessPaymentJob(repository, gateway, audit);
const processRefund = new ProcessRefundJob(repository, gateway, audit);
const stop = queue.consume(async (job) => {
  if (job.type === 'payment.process') await processPayment.execute(job.paymentId);
  if (job.type === 'payment.refund') await processRefund.execute(job.paymentId);
});

console.info('payment-worker started with PostgreSQL queue');

const shutdown = async () => {
  stop();
  await database.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
