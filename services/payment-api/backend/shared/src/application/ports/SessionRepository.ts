export type Session = { token: string; userId: string; expiresAt: number };

export interface SessionRepository {
  create(userId: string): Promise<Session>;
  find(token: string): Promise<Session | undefined>;
  delete(token: string): Promise<void>;
}
