import type { UserRepository } from '../../application/ports/UserRepository.js';
import type { User } from '../../domain/auth/User.js';

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();

  async findByEmail(email: string) {
    return [...this.users.values()].find((user) => user.email === email);
  }

  async findById(id: string) {
    return this.users.get(id);
  }

  async count() {
    return this.users.size;
  }

  async save(user: User) {
    this.users.set(user.id, user);
  }
}
