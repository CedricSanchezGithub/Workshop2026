export interface LockStatus {
  locked: boolean;
  retryAfterMs: number;
}

/**
 * Suivi des tentatives de connexion pour l'anti-bruteforce (WOR-98) :
 * après N échecs, l'identifiant est verrouillé pour une durée croissante.
 */
export interface LoginAttemptTracker {
  /** État courant du verrou pour cet identifiant. */
  status(key: string): LockStatus;
  /** Enregistre un échec et renvoie l'état résultant (verrouillé ou non). */
  recordFailure(key: string): LockStatus;
  /** Réinitialise le compteur (connexion réussie). */
  reset(key: string): void;
}
