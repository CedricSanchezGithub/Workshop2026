/** Erreur générique du service de reconnaissance faciale. */
export class FaceServiceError extends Error {}
/** Aucun visage détecté sur l'image fournie. */
export class NoFaceDetectedError extends Error {}

/**
 * Annuaire des visages (WOR-97) : association identifiant ↔ gabarit facial, géré par le
 * service de reconnaissance (WOR-95). Le back-office ne stocke ni images ni embeddings ;
 * il délègue au service, qui ne conserve que des embeddings (RGPD, WOR-101).
 */
export interface FaceDirectory {
  /** Enrôle (ou ajoute un échantillon pour) l'identifiant. */
  enroll(key: string, image: Buffer, contentType: string): Promise<{ samples: number }>;
  /** Vérifie si l'image correspond au gabarit enrôlé de l'identifiant. */
  verify(key: string, image: Buffer, contentType: string): Promise<{ match: boolean; score: number }>;
  /** Liste les identifiants enrôlés. */
  list(): Promise<string[]>;
  /** Supprime les gabarits de l'identifiant (droit à l'effacement). */
  remove(key: string): Promise<void>;
}
