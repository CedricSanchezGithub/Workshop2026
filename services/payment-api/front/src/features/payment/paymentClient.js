const PAYMENT_API_URL = import.meta.env.VITE_PAYMENT_API_URL ?? 'http://127.0.0.1:4000';
const getAuthHeaders = () => {
  const token = window.sessionStorage.getItem('payandgo:auth-token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const getIdempotencyKey = (bookingId) => {
  const keyName = `payandgo:idempotency:${bookingId}`;
  const existing = window.sessionStorage.getItem(keyName);
  if (existing) return existing;
  const key = `${bookingId}-${crypto.randomUUID()}`;
  window.sessionStorage.setItem(keyName, key);
  return key;
};

async function readResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'PAYMENT_API_UNAVAILABLE');
  return payload;
}

export async function createPaymentIntent(trip, paymentMethod) {
  const response = await fetch(`${PAYMENT_API_URL}/v1/payments/intents`, {
    method: 'POST',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json', 'Idempotency-Key': getIdempotencyKey(`booking_${trip.id}`) },
    body: JSON.stringify({ bookingId: `booking_${trip.id}`, amountCents: trip.price * 100, currency: 'EUR', paymentMethod }),
  });
  const payload = await readResponse(response);
  return { payment: payload.data, verification: payload.verification };
}

export async function getPaymentIntent(paymentId) {
  const response = await fetch(`${PAYMENT_API_URL}/v1/payments/${paymentId}`, { headers: getAuthHeaders() });
  const payload = await readResponse(response);
  return payload.data;
}

export async function verifyPayment(paymentId, code) {
  const response = await fetch(`${PAYMENT_API_URL}/v1/payments/${paymentId}/verify`, { method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
  const payload = await readResponse(response);
  return payload.data;
}

export async function refundPayment(paymentId) {
  const response = await fetch(`${PAYMENT_API_URL}/v1/payments/${paymentId}/refund`, { method: 'POST', headers: getAuthHeaders() });
  const payload = await readResponse(response);
  return payload.data;
}
