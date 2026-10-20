import { randomBytes } from 'node:crypto';
import type { Session, SessionRepository } from '../../application/ports/SessionRepository.js';

export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, Session>();

  async create(userId: string) {
    const session = { token: randomBytes(32).toString('hex'), userId, expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7 };
    this.sessions.set(session.token, session);
    return session;
  }

  async find(token: string) {
    const session = this.sessions.get(token);
    if (!session || session.expiresAt <= Date.now()) {
      if (session) this.sessions.delete(token);
      return undefined;
    }
    return session;
  }

  async delete(token: string) {
    this.sessions.delete(token);
  }
}
