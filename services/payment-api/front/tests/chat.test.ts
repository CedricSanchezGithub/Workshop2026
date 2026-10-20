import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAT_SCOPE_MESSAGE, isPayGoTopic } from '../../backend/shared/src/application/chat/ChatTopicGuard.js';

test('chatbot accepte uniquement les questions liées à Pay&Go', () => {
  assert.equal(isPayGoTopic('Comment réserver un billet de train ?'), true);
  assert.equal(isPayGoTopic('Comment demander un remboursement ?'), true);
  assert.equal(isPayGoTopic('Quel temps fera-t-il demain ?'), false);
  assert.equal(isPayGoTopic('Écris-moi un poème'), false);
  assert.match(CHAT_SCOPE_MESSAGE, /Pay&Go/);
});
