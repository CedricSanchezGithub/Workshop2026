export type AuditEvent = {
  event: string;
  paymentId?: string;
  userId?: string;
  metadata?: Record<string, string | number | boolean>;
};

export interface AuditLogger {
  write(event: AuditEvent): void;
}
