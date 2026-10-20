import { getAuthToken } from '../auth/authClient';

const API_URL = import.meta.env.VITE_PAYMENT_API_URL || 'http://127.0.0.1:4000';

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}`, ...(options.headers || {}) } });
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
