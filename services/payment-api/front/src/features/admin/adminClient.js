import { getAuthToken } from '../auth/authClient';

const API_URL = import.meta.env.VITE_PAYMENT_API_URL ?? 'http://127.0.0.1:4000';

async function request(path, options = {}) {
  const contentType = options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' };
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { ...contentType, Authorization: `Bearer ${getAuthToken()}`, ...(options.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'ADMIN_API_UNAVAILABLE');
  return payload.data;
}

export function getAdminOverview() {
  return request('/v1/admin/overview');
}

export function scalePaymentWorkers(workerCount) {
  return request('/v1/admin/scaling', { method: 'POST', body: JSON.stringify({ workerCount }) });
}

// Habilitations faciales (WOR-97) : association compte ↔ visage, gérée par le service de reconnaissance.
export function listEnrolledFaces() {
  return request('/v1/admin/faces');
}

// Image envoyée en fichier multipart (et non en base64 dans du JSON, bloqué par le CRS du WAF).
export function enrollFace(email, image) {
  const body = new FormData();
  body.set('email', email);
  body.set('image', image, 'face.jpg');
  return request('/v1/admin/faces/enroll', { method: 'POST', body });
}

export function revokeFace(email) {
  return request('/v1/admin/faces/revoke', { method: 'POST', body: JSON.stringify({ email }) });
}
