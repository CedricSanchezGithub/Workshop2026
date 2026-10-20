import { randomBytes } from 'node:crypto';
import type { Session, SessionRepository } from '../../application/ports/SessionRepository.js';
import { PostgresDatabase } from '../database/PostgresDatabase.js';

export class PostgresSessionRepository implements SessionRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async create(userId: string) {
    const session: Session = { token: randomBytes(32).toString('hex'), userId, expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7 };
    await this.database.query('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1,$2,$3)', [session.token, session.userId, new Date(session.expiresAt).toISOString()]);
    return session;
  }

  async find(token: string) {
    const result = await this.database.query('SELECT token, user_id, EXTRACT(EPOCH FROM expires_at) * 1000 AS expires_at_ms FROM sessions WHERE token = $1', [token]);
    const row = result.rows[0];
    if (!row) return undefined;
    const session: Session = { token: String(row.token), userId: String(row.user_id), expiresAt: Number(row.expires_at_ms) };
    if (session.expiresAt <= Date.now()) {
      await this.delete(token);
      return undefined;
    }
    return session;
  }

  async delete(token: string) {
    await this.database.query('DELETE FROM sessions WHERE token = $1', [token]);
  }
}
