export type User = {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  passwordHash: string;
  avatarSvg: string;
  createdAt: string;
};

export type PublicUser = Omit<User, 'passwordHash'>;

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}
