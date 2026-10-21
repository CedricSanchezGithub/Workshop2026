import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LoginUser, LoginUserError, AccountLockedError } from '../../backend/shared/src/application/use-cases/LoginUser.js';
import { RegisterUser } from '../../backend/shared/src/application/use-cases/RegisterUser.js';
import { JdenticonAvatarGenerator } from '../../backend/shared/src/infrastructure/avatars/JdenticonAvatarGenerator.js';
import { InMemorySessionRepository } from '../../backend/shared/src/infrastructure/repositories/InMemorySessionRepository.js';
import { InMemoryUserRepository } from '../../backend/shared/src/infrastructure/repositories/InMemoryUserRepository.js';
import { ScryptPasswordHasher } from '../../backend/shared/src/infrastructure/security/ScryptPasswordHasher.js';
import { InMemoryLoginAttemptTracker } from '../../backend/shared/src/infrastructure/security/InMemoryLoginAttemptTracker.js';

const PASSWORD = 'PayGo!123';

async function setup(clock: () => number) {
  const users = new InMemoryUserRepository();
  const sessions = new InMemorySessionRepository();
  const passwords = new ScryptPasswordHasher();
  await new RegisterUser(users, sessions, passwords, new JdenticonAvatarGenerator())
    .execute({ name: 'Marie', email: 'marie@example.test', password: PASSWORD });
  const tracker = new InMemoryLoginAttemptTracker(2, 5 * 60_000, clock);
  return new LoginUser(users, sessions, passwords, tracker);
}

test('verrouille après 2 échecs, bloque même avec le bon mot de passe, déverrouille après 5 min', async () => {
  let now = 0;
  const login = await setup(() => now);
  const creds = { email: 'marie@example.test', password: 'wrong' };

  // 1er échec : encore autorisé (1 réessai)
  await assert.rejects(() => login.execute(creds), (e: unknown) => e instanceof LoginUserError);
  // 2e échec : verrouillage
  await assert.rejects(() => login.execute(creds), (e: unknown) => e instanceof AccountLockedError && e.retryAfterMs === 5 * 60_000);
  // Verrouillé : même le BON mot de passe est refusé (pas de contournement)
  await assert.rejects(
    () => login.execute({ email: 'marie@example.test', password: PASSWORD }),
    (e: unknown) => e instanceof AccountLockedError,
  );

  // Après l'expiration du verrou : le bon mot de passe passe et réinitialise le compteur
  now = 5 * 60_000 + 1;
  const ok = await login.execute({ email: 'marie@example.test', password: PASSWORD });
  assert.ok(ok.token);
});

test('la durée de blocage augmente à chaque cycle (escalade)', async () => {
  let now = 0;
  const login = await setup(() => now);
  const creds = { email: 'marie@example.test', password: 'wrong' };

  await assert.rejects(() => login.execute(creds), (e: unknown) => e instanceof LoginUserError);
  await assert.rejects(() => login.execute(creds), (e: unknown) => e instanceof AccountLockedError && e.retryAfterMs === 5 * 60_000);

  now = 5 * 60_000; // verrou expiré
  await assert.rejects(() => login.execute(creds), (e: unknown) => e instanceof LoginUserError);
  await assert.rejects(() => login.execute(creds), (e: unknown) => e instanceof AccountLockedError && e.retryAfterMs === 10 * 60_000);
});
