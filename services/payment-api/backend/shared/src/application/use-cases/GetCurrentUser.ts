import type { SessionRepository } from '../ports/SessionRepository.js';
import type { UserRepository } from '../ports/UserRepository.js';
import { toPublicUser } from '../../domain/auth/User.js';

export class GetCurrentUser {
  constructor(private readonly users: UserRepository, private readonly sessions: SessionRepository) {}

  async execute(token: string) {
    const session = await this.sessions.find(token);
    const user = session ? await this.users.findById(session.userId) : undefined;
    return user ? toPublicUser(user) : undefined;
  }
}
