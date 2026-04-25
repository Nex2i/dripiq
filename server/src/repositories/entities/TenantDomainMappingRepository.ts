import { eq } from 'drizzle-orm';
import {
  tenantDomainMappings,
  TenantDomainMapping,
  NewTenantDomainMapping,
  tenants,
  Tenant,
} from '@/db/schema';
import { BaseRepository } from '../base/BaseRepository';

export class TenantDomainMappingRepository extends BaseRepository<
  typeof tenantDomainMappings,
  TenantDomainMapping,
  NewTenantDomainMapping
> {
  constructor() {
    super(tenantDomainMappings);
  }

  async findByDomain(domain: string): Promise<TenantDomainMapping | undefined> {
    const [result] = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.domain, domain))
      .limit(1);

    return result;
  }

  async findTenantByDomain(domain: string): Promise<Tenant | undefined> {
    const [result] = await this.db
      .select({
        tenant: tenants,
      })
      .from(this.table)
      .innerJoin(tenants, eq(this.table.tenantId, tenants.id))
      .where(eq(this.table.domain, domain))
      .limit(1);

    return result?.tenant;
  }
}
