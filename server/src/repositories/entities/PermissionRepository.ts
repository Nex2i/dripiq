import { eq, and } from 'drizzle-orm';
import { BaseRepository } from '../base/BaseRepository';
import { permissions, Permission, NewPermission } from '@/db/schema';

export class PermissionRepository extends BaseRepository<typeof permissions, Permission, NewPermission> {
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
   * Find permissions by resource
   */
  async findByResource(resource: string): Promise<Permission[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.resource, resource));
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

  /**
   * Check if permission exists by name
   */
  async existsByName(name: string): Promise<boolean> {
    const result = await this.findByName(name);
    return !!result;
  }

  /**
   * Check if permission exists by resource and action
   */
  async existsByResourceAndAction(resource: string, action: string): Promise<boolean> {
    const result = await this.findByResourceAndAction(resource, action);
    return !!result;
  }

  /**
   * Create permission with duplicate check
   */
  async createIfNotExists(data: NewPermission): Promise<Permission> {
    const existing = await this.findByName(data.name);
    if (existing) {
      return existing;
    }
    return await this.create(data);
  }

  /**
   * Get all permissions grouped by resource
   */
  async findAllGroupedByResource(): Promise<Record<string, Permission[]>> {
    const allPermissions = await this.findAll();
    const grouped: Record<string, Permission[]> = {};
    
    for (const permission of allPermissions) {
      if (!grouped[permission.resource]) {
        grouped[permission.resource] = [];
      }
      grouped[permission.resource]!.push(permission);
    }
    
    return grouped;
  }
}