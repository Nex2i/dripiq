import { eq, sql } from 'drizzle-orm';
import { encrypt, decrypt } from '@/utils/crypto';
import {
  tenantZoominfoCredentials,
  TenantZoominfoCredential,
  NewTenantZoominfoCredential,
} from '@/db/schema';
import { BaseRepository } from '../base/BaseRepository';

export type SaveTenantZoominfoCredentialsInput = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
};

/**
 * Tenant-scoped ZoomInfo OAuth app credentials (client id + encrypted secret).
 */
export class TenantZoominfoCredentialsRepository extends BaseRepository<
  typeof tenantZoominfoCredentials,
  TenantZoominfoCredential,
  NewTenantZoominfoCredential
> {
  constructor() {
    super(tenantZoominfoCredentials);
  }

  async findByTenantId(tenantId: string): Promise<TenantZoominfoCredential | undefined> {
    const [row] = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.tenantId, tenantId))
      .limit(1);
    return row;
  }

  async upsertCredentials(
    input: SaveTenantZoominfoCredentialsInput
  ): Promise<TenantZoominfoCredential> {
    const secretEnc = encrypt(input.clientSecret);
    const now = new Date();
    const [row] = await this.db
      .insert(this.table)
      .values({
        tenantId: input.tenantId,
        clientId: input.clientId,
        clientSecretEnc: secretEnc,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: this.table.tenantId,
        set: {
          clientId: sql`excluded.client_id`,
          clientSecretEnc: sql`excluded.client_secret_enc`,
          updatedAt: sql`excluded.updated_at`,
        },
      })
      .returning();
    return row as TenantZoominfoCredential;
  }

  async deleteByTenantId(tenantId: string): Promise<void> {
    await this.db.delete(this.table).where(eq(this.table.tenantId, tenantId));
  }

  getDecryptedSecret(row: TenantZoominfoCredential): string {
    return decrypt(row.clientSecretEnc);
  }
}
