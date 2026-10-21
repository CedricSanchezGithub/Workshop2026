import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryFaceChallenge } from '../../backend/shared/src/infrastructure/security/InMemoryFaceChallenge.js';

test('le jeton de défi facial est valide une seule fois', () => {
  const challenge = new InMemoryFaceChallenge();
  const token = challenge.issue('marie@example.test');
  assert.equal(challenge.consume('marie@example.test', token), true);
  // usage unique : un deuxième consume échoue
  assert.equal(challenge.consume('marie@example.test', token), false);
});

test('un mauvais jeton ou un autre identifiant est refusé', () => {
  const challenge = new InMemoryFaceChallenge();
  const token = challenge.issue('marie@example.test');
  assert.equal(challenge.consume('marie@example.test', 'faux'), false);
  // le jeton a été consommé par la tentative ci-dessus (usage unique) : le vrai échoue aussi
  assert.equal(challenge.consume('bob@example.test', token), false);
});

test('le jeton expire après sa durée de vie', () => {
  let now = 0;
  const challenge = new InMemoryFaceChallenge(120_000, () => now);
  const token = challenge.issue('marie@example.test');
  now = 120_001;
  assert.equal(challenge.consume('marie@example.test', token), false);
});
