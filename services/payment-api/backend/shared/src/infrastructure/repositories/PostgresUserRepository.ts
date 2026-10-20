import type { UserRepository } from '../../application/ports/UserRepository.js';
import type { User } from '../../domain/auth/User.js';
import { PostgresDatabase } from '../database/PostgresDatabase.js';
import { toUser } from './PostgresMappers.js';

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async findByEmail(email: string) {
    const result = await this.database.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] ? toUser(result.rows[0]) : undefined;
  }

  async findById(id: string) {
    const result = await this.database.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] ? toUser(result.rows[0]) : undefined;
  }

  async count() {
    const result = await this.database.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM users');
    return Number(result.rows[0]?.count ?? 0);
  }

  async save(user: User) {
    await this.database.query(
      `INSERT INTO users (id, name, email, role, password_hash, avatar_svg, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [user.id, user.name, user.email, user.role, user.passwordHash, user.avatarSvg, user.createdAt],
    );
  }
}
