import { eq } from 'drizzle-orm';
import { tenants, Tenant, NewTenant } from '@/db/schema';
import { NotFoundError } from '@/exceptions/error';
import { BaseRepository } from '../base/BaseRepository';

export class TenantRepository extends BaseRepository<typeof tenants, Tenant, NewTenant> {
  constructor() {
    super(tenants);
  }

  /**
   * Find tenant by name
   */
  async findByName(name: string): Promise<Tenant> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.name, name))
      .limit(1);

    if (!results[0]) {
      throw new NotFoundError(`Tenant with name ${name} not found`);
    }

    return results[0];
  }

  /**
   * Create tenant with formatted name
   */
  async createWithFormattedName(data: Omit<NewTenant, 'name'> & { name: string }): Promise<Tenant> {
    // Auto-format tenant name: lowercase and replace spaces with hyphens
    const formattedName = data.name.toLowerCase().replace(/\s+/g, '-');

    const tenantData: NewTenant = {
      ...data,
      name: formattedName,
    };

    return await this.create(tenantData);
  }
}
