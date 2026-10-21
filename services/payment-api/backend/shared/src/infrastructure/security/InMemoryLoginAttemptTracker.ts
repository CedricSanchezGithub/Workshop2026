import type { LockStatus, LoginAttemptTracker } from '../../application/ports/LoginAttemptTracker.js';

type Entry = { failures: number; lockedUntil: number; lockLevel: number };

/**
 * Anti-bruteforce en mémoire (WOR-98). Politique de la consigne additionnelle 1 :
 * « peut recommencer 1 fois puis est bloqué 5 minutes, etc. »
 *
 * - `maxAttempts` échecs consécutifs (défaut 2 = 1 essai + 1 réessai) → verrouillage.
 * - Durée **croissante** : 5 min, puis 10, 15… (`baseLockMs` × niveau) à chaque cycle.
 * - Une connexion réussie réinitialise tout.
 */
export class InMemoryLoginAttemptTracker implements LoginAttemptTracker {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly maxAttempts = 2,
    private readonly baseLockMs = 5 * 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  status(key: string): LockStatus {
    const entry = this.entries.get(key);
    if (!entry) return { locked: false, retryAfterMs: 0 };
    const remaining = entry.lockedUntil - this.now();
    return remaining > 0 ? { locked: true, retryAfterMs: remaining } : { locked: false, retryAfterMs: 0 };
  }

  recordFailure(key: string): LockStatus {
    const entry = this.entries.get(key) ?? { failures: 0, lockedUntil: 0, lockLevel: 0 };
    entry.failures += 1;
    if (entry.failures >= this.maxAttempts) {
      entry.lockLevel += 1;
      entry.lockedUntil = this.now() + this.baseLockMs * entry.lockLevel;
      entry.failures = 0;
      this.entries.set(key, entry);
      return { locked: true, retryAfterMs: entry.lockedUntil - this.now() };
    }
    this.entries.set(key, entry);
    return { locked: false, retryAfterMs: 0 };
  }

  reset(key: string): void {
    this.entries.delete(key);
  }
}
