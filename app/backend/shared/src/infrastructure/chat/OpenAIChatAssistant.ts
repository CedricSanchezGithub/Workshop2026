import type { ChatAssistant, ChatMessage } from '../../application/ports/ChatAssistant.js';

export class ChatAssistantError extends Error {
  constructor(message: 'CHAT_NOT_CONFIGURED' | 'CHAT_PROVIDER_ERROR') {
    super(message);
    this.name = 'ChatAssistantError';
  }
}

type ChatCompletionResponse = { choices?: Array<{ message?: { content?: unknown } }> };

export class OpenAIChatAssistant implements ChatAssistant {
  private readonly apiKey = process.env.OPENAI_API_KEY?.trim();
  private readonly baseUrl = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  private readonly model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

  async reply(messages: ChatMessage[]): Promise<string> {
    if (!this.apiKey) throw new ChatAssistantError('CHAT_NOT_CONFIGURED');

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.2,
          max_tokens: 240,
          messages: [
            { role: 'system', content: 'Tu es l’assistant de Pay&Go. Réponds uniquement aux questions liées à l’application : trajets, réservations, paiements fictifs, remboursements, compte et assistance. Pour toute autre demande, réponds exactement que tu peux uniquement aider sur Pay&Go. Réponds en français et de façon concise. Ne demande jamais de numéro de carte, CVV, mot de passe ou clé API. Si une action nécessite l’interface, explique où cliquer.' },
            ...messages,
          ],
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new ChatAssistantError('CHAT_PROVIDER_ERROR');
    }

    if (!response.ok) throw new ChatAssistantError('CHAT_PROVIDER_ERROR');
    const payload = await response.json() as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new ChatAssistantError('CHAT_PROVIDER_ERROR');
    return content.trim().slice(0, 2_000);
  }
}
