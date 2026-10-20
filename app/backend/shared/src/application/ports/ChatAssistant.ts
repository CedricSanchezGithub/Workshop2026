export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export interface ChatAssistant {
  reply(messages: ChatMessage[]): Promise<string>;
}
