import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LoginUser, LoginUserError } from '../../backend/shared/src/application/use-cases/LoginUser.js';
import { RegisterUser, RegisterUserError } from '../../backend/shared/src/application/use-cases/RegisterUser.js';
import { GetCurrentUser } from '../../backend/shared/src/application/use-cases/GetCurrentUser.js';
import { JdenticonAvatarGenerator } from '../../backend/shared/src/infrastructure/avatars/JdenticonAvatarGenerator.js';
import { InMemorySessionRepository } from '../../backend/shared/src/infrastructure/repositories/InMemorySessionRepository.js';
import { InMemoryUserRepository } from '../../backend/shared/src/infrastructure/repositories/InMemoryUserRepository.js';
import { ScryptPasswordHasher } from '../../backend/shared/src/infrastructure/security/ScryptPasswordHasher.js';

test('scrypt hash vérifie le bon mot de passe et rejette le mauvais', async () => {
  const hasher = new ScryptPasswordHasher();
  const encoded = await hasher.hash('PayGo!123');
  assert.notEqual(encoded, 'PayGo!123');
  assert.match(encoded, /^scrypt\$[^$]+\$[a-f0-9]+$/);
  assert.equal(await hasher.verify('PayGo!123', encoded), true);
  assert.equal(await hasher.verify('wrong-password', encoded), false);
});

test('inscription, identicon stable, connexion et déconnexion', async () => {
  const users = new InMemoryUserRepository();
  const sessions = new InMemorySessionRepository();
  const passwords = new ScryptPasswordHasher();
  const avatars = new JdenticonAvatarGenerator();
  const register = new RegisterUser(users, sessions, passwords, avatars);
  const login = new LoginUser(users, sessions, passwords);
  const currentUser = new GetCurrentUser(users, sessions);

  const first = await register.execute({ name: ' Marie Dupont ', email: 'MARIE@EXAMPLE.TEST', password: 'PayGo!123' });
  assert.equal(first.user.email, 'marie@example.test');
  assert.equal(first.user.role, 'user');
  assert.equal('passwordHash' in first.user, false);
  assert.match(first.user.avatarSvg, /^<svg/);
  assert.match(first.user.avatarSvg, /width="96"/);
  assert.match(first.user.avatarSvg, /fill="#111111"/);
  assert.equal(avatars.generate('marie@example.test:Marie Dupont'), first.user.avatarSvg);
  assert.equal((await currentUser.execute(first.token))?.id, first.user.id);

  await assert.rejects(() => register.execute({ name: 'Another', email: 'marie@example.test', password: 'PayGo!123' }), (error: unknown) => error instanceof RegisterUserError && error.message === 'EMAIL_ALREADY_REGISTERED');
  await assert.rejects(() => login.execute({ email: 'marie@example.test', password: 'bad-password' }), (error: unknown) => error instanceof LoginUserError && error.message === 'INVALID_CREDENTIALS');

  const loggedIn = await login.execute({ email: 'marie@example.test', password: 'PayGo!123' });
  assert.equal(loggedIn.user.id, first.user.id);
  assert.ok(loggedIn.token);
  await sessions.delete(loggedIn.token);
  assert.equal(await currentUser.execute(loggedIn.token), undefined);
});

test('un email d’administration configuré reçoit le rôle admin', async () => {
  const users = new InMemoryUserRepository();
  const sessions = new InMemorySessionRepository();
  const register = new RegisterUser(users, sessions, new ScryptPasswordHasher(), new JdenticonAvatarGenerator(), new Set(['admin@example.test']));
  const session = await register.execute({ name: 'Admin', email: 'ADMIN@EXAMPLE.TEST', password: 'PayGo!123' });
  assert.equal(session.user.role, 'admin');
});
