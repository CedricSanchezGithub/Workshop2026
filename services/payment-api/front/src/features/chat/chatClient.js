const CHAT_API_URL = import.meta.env.VITE_PAYMENT_API_URL ?? 'http://127.0.0.1:4000';

export async function askChatbot(messages) {
  const response = await fetch(`${CHAT_API_URL}/v1/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: messages.slice(-8) }),
  });

  if (response.status === 422) {
    const payload = await response.json();
    return payload.message;
  }
  if (!response.ok) throw new Error('CHAT_UNAVAILABLE');
  const payload = await response.json();
  return payload.data.message;
}
