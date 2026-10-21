import type { PasswordHasher } from '../ports/PasswordHasher.js';
import type { SessionRepository } from '../ports/SessionRepository.js';
import type { UserRepository } from '../ports/UserRepository.js';
import type { LoginAttemptTracker } from '../ports/LoginAttemptTracker.js';
import { toPublicUser } from '../../domain/auth/User.js';

export class LoginUserError extends Error {}

/** Compte temporairement verrouillé par l'anti-bruteforce (WOR-98). */
export class AccountLockedError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super('ACCOUNT_LOCKED');
  }
}

// Objet nul : aucun verrouillage (utilisé quand aucun tracker n'est fourni, ex. tests legacy).
const NO_LOCKOUT: LoginAttemptTracker = {
  status: () => ({ locked: false, retryAfterMs: 0 }),
  recordFailure: () => ({ locked: false, retryAfterMs: 0 }),
  reset: () => {},
};

export class LoginUser {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly passwords: PasswordHasher,
    private readonly attempts: LoginAttemptTracker = NO_LOCKOUT,
  ) {}

  async execute(input: { email: string; password: string }) {
    const key = input.email.trim().toLowerCase();

    const lock = this.attempts.status(key);
    if (lock.locked) throw new AccountLockedError(lock.retryAfterMs);

    const user = await this.users.findByEmail(key);
    if (!user || !(await this.passwords.verify(input.password, user.passwordHash))) {
      const after = this.attempts.recordFailure(key);
      if (after.locked) throw new AccountLockedError(after.retryAfterMs);
      throw new LoginUserError('INVALID_CREDENTIALS');
    }

    this.attempts.reset(key);
    return { user: toPublicUser(user), token: (await this.sessions.create(user.id)).token };
  }
}
