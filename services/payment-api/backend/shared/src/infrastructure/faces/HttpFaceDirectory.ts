import type { FaceDirectory } from '../../application/ports/FaceDirectory.js';
import { FaceServiceError, NoFaceDetectedError } from '../../application/ports/FaceDirectory.js';

/**
 * Adaptateur HTTP vers le service de reconnaissance faciale (WOR-95), joignable sur le
 * réseau interne `backend`. Utilise fetch/FormData/Blob natifs (Node 22).
 */
export class HttpFaceDirectory implements FaceDirectory {
  constructor(private readonly baseUrl: string) {}

  async enroll(key: string, image: Buffer, contentType: string): Promise<{ samples: number }> {
    const form = new FormData();
    form.set('user', key);
    form.set('image', new Blob([new Uint8Array(image)], { type: contentType }), 'face');
    const response = await fetch(`${this.baseUrl}/enroll`, { method: 'POST', body: form });
    if (response.status === 422) throw new NoFaceDetectedError('NO_FACE_DETECTED');
    if (!response.ok) throw new FaceServiceError(`FACE_SERVICE_${response.status}`);
    const data = (await response.json()) as { samples?: number };
    return { samples: data.samples ?? 0 };
  }

  async list(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/users`);
    if (!response.ok) throw new FaceServiceError(`FACE_SERVICE_${response.status}`);
    const data = (await response.json()) as { users?: string[] };
    return data.users ?? [];
  }

  async remove(key: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/users/${encodeURIComponent(key)}`, { method: 'DELETE' });
    if (!response.ok) throw new FaceServiceError(`FACE_SERVICE_${response.status}`);
  }
}
