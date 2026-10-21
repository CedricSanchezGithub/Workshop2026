import { randomUUID } from 'node:crypto';

/**
 * Jeton de défi facial (WOR-96) : émis après une reconnaissance réussie, à présenter lors
 * du `POST /v1/auth/login`. À usage unique et à durée de vie courte, pour imposer l'ordre
 * « identifiant → caméra → mot de passe » et empêcher de sauter l'étape caméra.
 */
export class InMemoryFaceChallenge {
  private readonly tokens = new Map<string, { token: string; expiresAt: number }>();

  constructor(private readonly ttlMs = 120_000, private readonly now: () => number = Date.now) {}

  issue(key: string): string {
    const token = randomUUID();
    this.tokens.set(key, { token, expiresAt: this.now() + this.ttlMs });
    return token;
  }

  /** Valide ET consomme le jeton (usage unique). */
  consume(key: string, token: string): boolean {
    const entry = this.tokens.get(key);
    if (!entry) return false;
    this.tokens.delete(key);
    return entry.token === token && entry.expiresAt > this.now();
  }
}
