import type { AuditEvent, AuditLogger } from '../../application/ports/AuditLogger.js';

export class ConsoleAuditLogger implements AuditLogger {
  write(event: AuditEvent) {
    console.info(JSON.stringify({ ...event, at: new Date().toISOString() }));
  }
}
