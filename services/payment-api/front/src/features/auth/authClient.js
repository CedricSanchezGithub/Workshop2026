const AUTH_API_URL = import.meta.env.VITE_PAYMENT_API_URL || 'http://127.0.0.1:4000';
const TOKEN_KEY = 'payandgo:auth-token';

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${AUTH_API_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  } catch {
    throw new Error('AUTH_API_UNAVAILABLE');
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'AUTH_API_UNAVAILABLE');
  return payload.data;
}

export function getAuthToken() { return window.sessionStorage.getItem(TOKEN_KEY); }

export function saveAuthSession(session) {
  window.sessionStorage.setItem(TOKEN_KEY, session.token);
  return session.user;
}

export function clearAuthSession() { window.sessionStorage.removeItem(TOKEN_KEY); }

export async function registerUser(input) {
  const session = await request('/v1/auth/register', { method: 'POST', body: JSON.stringify(input) });
  saveAuthSession(session);
  return session;
}

export async function faceCheck(email, imageBase64) {
  return request('/v1/auth/face-check', { method: 'POST', body: JSON.stringify({ email, imageBase64 }) });
}

export async function loginUser(input) {
  const session = await request('/v1/auth/login', { method: 'POST', body: JSON.stringify(input) });
  saveAuthSession(session);
  return session;
}

export async function getCurrentUser() {
  if (!getAuthToken()) return null;
  try {
    const result = await request('/v1/auth/me', { headers: { Authorization: `Bearer ${getAuthToken()}` } });
    return result;
  } catch {
    clearAuthSession();
    return null;
  }
}

export async function logoutUser() {
  const token = getAuthToken();
  if (token) await request('/v1/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined);
  clearAuthSession();
}
