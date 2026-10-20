import { randomUUID } from 'node:crypto';
import type { AvatarGenerator } from '../ports/AvatarGenerator.js';
import type { PasswordHasher } from '../ports/PasswordHasher.js';
import type { SessionRepository } from '../ports/SessionRepository.js';
import type { UserRepository } from '../ports/UserRepository.js';
import { toPublicUser } from '../../domain/auth/User.js';

export class RegisterUserError extends Error {}

export class RegisterUser {
  constructor(private readonly users: UserRepository, private readonly sessions: SessionRepository, private readonly passwords: PasswordHasher, private readonly avatars: AvatarGenerator, private readonly adminEmails = new Set<string>()) {}

  async execute(input: { name: string; email: string; password: string }) {
    const email = input.email.trim().toLowerCase();
    if (await this.users.findByEmail(email)) throw new RegisterUserError('EMAIL_ALREADY_REGISTERED');
    const user = { id: `usr_${randomUUID()}`, name: input.name.trim(), email, role: this.adminEmails.has(email) ? 'admin' as const : 'user' as const, passwordHash: await this.passwords.hash(input.password), avatarSvg: this.avatars.generate(`${email}:${input.name.trim()}`), createdAt: new Date().toISOString() };
    await this.users.save(user);
    const session = await this.sessions.create(user.id);
    return { user: toPublicUser(user), token: session.token };
  }
}
