import type { User } from '../../domain/auth/User.js';

export interface UserRepository {
  findByEmail(email: string): Promise<User | undefined>;
  findById(id: string): Promise<User | undefined>;
  count(): Promise<number>;
  save(user: User): Promise<void>;
}
