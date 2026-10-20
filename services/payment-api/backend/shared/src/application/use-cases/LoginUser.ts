import type { PasswordHasher } from '../ports/PasswordHasher.js';
import type { SessionRepository } from '../ports/SessionRepository.js';
import type { UserRepository } from '../ports/UserRepository.js';
import { toPublicUser } from '../../domain/auth/User.js';

export class LoginUserError extends Error {}

export class LoginUser {
  constructor(private readonly users: UserRepository, private readonly sessions: SessionRepository, private readonly passwords: PasswordHasher) {}

  async execute(input: { email: string; password: string }) {
    const user = await this.users.findByEmail(input.email.trim().toLowerCase());
    if (!user || !(await this.passwords.verify(input.password, user.passwordHash))) throw new LoginUserError('INVALID_CREDENTIALS');
    return { user: toPublicUser(user), token: (await this.sessions.create(user.id)).token };
  }
}
