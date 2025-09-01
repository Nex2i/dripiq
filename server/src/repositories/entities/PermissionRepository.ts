import { eq, and } from 'drizzle-orm';
import { permissions, Permission, NewPermission } from '@/db/schema';
import { BaseRepository } from '../base/BaseRepository';

export class PermissionRepository extends BaseRepository<
  typeof permissions,
  Permission,
  NewPermission
> {
  constructor() {
    super(permissions);
  }

  /**
   * Find permission by name
   */
  async findByName(name: string): Promise<Permission | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.name, name))
      .limit(1);
    return results[0];
  }

  /**
   * Find permission by resource and action
   */
  async findByResourceAndAction(resource: string, action: string): Promise<Permission | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.resource, resource), eq(this.table.action, action)))
      .limit(1);
    return results[0];
  }
}
