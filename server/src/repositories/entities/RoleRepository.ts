import { eq } from 'drizzle-orm';
import { roles, Role, NewRole } from '@/db/schema';
import { BaseRepository } from '../base/BaseRepository';

export class RoleRepository extends BaseRepository<typeof roles, Role, NewRole> {
  constructor() {
    super(roles);
  }

  /**
   * Find role by name
   */
  async findByName(name: string): Promise<Role | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.name, name))
      .limit(1);
    return results[0];
  }

  /**
   * Check if role exists by name
   */
  async existsByName(name: string): Promise<boolean> {
    const result = await this.findByName(name);
    return !!result;
  }

  /**
   * Create role with duplicate check
   */
  async createIfNotExists(data: NewRole): Promise<Role> {
    const existing = await this.findByName(data.name);
    if (existing) {
      return existing;
    }
    return await this.create(data);
  }
}
