# TICKET-014: Data Migration and Backward Compatibility

## **Priority:** High
## **Estimated Time:** 3-4 days
## **Phase:** 5 - Integration with Existing Codebase
## **Dependencies:** TICKET-007, TICKET-008

---

## **Description**
Implement data migration scripts and backward compatibility measures to ensure existing SendGrid configurations and sender identities continue to work during and after the transition to the new provider system.

## **Acceptance Criteria**

### **Must Have**
- [ ] Create migration script for existing SendGrid configurations
- [ ] Migrate existing sender identities to new provider system
- [ ] Ensure backward compatibility with existing SendGrid usage
- [ ] Create rollback procedures for safe deployment
- [ ] Validate no data loss during migration

### **Should Have**
- [ ] Create migration validation tools
- [ ] Implement gradual migration strategy
- [ ] Add migration progress monitoring
- [ ] Include data integrity checks

### **Could Have**
- [ ] Create migration reporting dashboard
- [ ] Implement automated rollback triggers
- [ ] Add migration performance optimization

## **Technical Requirements**

### **Migration Scripts Structure**
```
server/src/db/migrations/
├── XXXX_create_provider_tables.sql (from TICKET-007)
├── XXXX_migrate_sendgrid_data.sql
├── XXXX_update_sender_identities.sql
└── migration-scripts/
    ├── migrate-sendgrid-configs.ts
    ├── validate-migration.ts
    └── rollback-migration.ts
```

### **SendGrid Data Migration Script**
**File:** `server/src/db/migrations/XXXX_migrate_sendgrid_data.sql`

```sql
-- Migration script to create default SendGrid provider configs for existing tenants
-- This ensures backward compatibility with existing SendGrid usage

-- Step 1: Create default SendGrid configurations for tenants with existing sender identities
INSERT INTO "dripiq_app"."email_provider_configs" (
  "id",
  "tenant_id",
  "type",
  "name",
  "config",
  "is_default",
  "is_active",
  "created_at",
  "updated_at"
)
SELECT 
  generate_cuid() as id,
  t.id as tenant_id,
  'sendgrid' as type,
  'SendGrid (Migrated)' as name,
  jsonb_build_object(
    'legacy', true,
    'migrated_at', NOW(),
    'api_key_ref', 'SENDGRID_API_KEY' -- Reference to environment variable
  ) as config,
  true as is_default,
  true as is_active,
  NOW() as created_at,
  NOW() as updated_at
FROM "dripiq_app"."tenants" t
WHERE EXISTS (
  SELECT 1 
  FROM "dripiq_app"."email_sender_identities" esi 
  WHERE esi.tenant_id = t.id 
  AND esi.sendgrid_sender_id IS NOT NULL
)
-- Only create if no provider config exists yet
AND NOT EXISTS (
  SELECT 1 
  FROM "dripiq_app"."email_provider_configs" epc 
  WHERE epc.tenant_id = t.id
);

-- Step 2: Update existing sender identities to reference the new provider configs
UPDATE "dripiq_app"."email_sender_identities" 
SET 
  "provider_config_id" = epc.id,
  "provider_validation_data" = jsonb_build_object(
    'sendgrid_sender_id', "sendgrid_sender_id",
    'migrated_at', NOW(),
    'legacy_validation', true
  ),
  "updated_at" = NOW()
FROM "dripiq_app"."email_provider_configs" epc
WHERE 
  "email_sender_identities"."tenant_id" = epc.tenant_id
  AND epc.type = 'sendgrid'
  AND epc.name = 'SendGrid (Migrated)'
  AND "email_sender_identities"."sendgrid_sender_id" IS NOT NULL
  AND "email_sender_identities"."provider_config_id" IS NULL;

-- Step 3: Create audit log entry for migration tracking
INSERT INTO "dripiq_app"."migration_audit_log" (
  "migration_name",
  "tenant_id",
  "status",
  "details",
  "executed_at"
)
SELECT 
  'sendgrid_provider_migration' as migration_name,
  t.id as tenant_id,
  'completed' as status,
  jsonb_build_object(
    'migrated_identities', (
      SELECT COUNT(*) 
      FROM "dripiq_app"."email_sender_identities" esi 
      WHERE esi.tenant_id = t.id 
      AND esi.provider_config_id IS NOT NULL
    ),
    'created_provider_config', true
  ) as details,
  NOW() as executed_at
FROM "dripiq_app"."tenants" t
WHERE EXISTS (
  SELECT 1 
  FROM "dripiq_app"."email_provider_configs" epc 
  WHERE epc.tenant_id = t.id 
  AND epc.type = 'sendgrid'
  AND epc.name = 'SendGrid (Migrated)'
);
```

### **Migration Audit Table**
**File:** `server/src/db/migrations/XXXX_create_migration_audit_table.sql`

```sql
-- Create audit table for tracking migrations
CREATE TABLE IF NOT EXISTS "dripiq_app"."migration_audit_log" (
  "id" text PRIMARY KEY DEFAULT generate_cuid(),
  "migration_name" text NOT NULL,
  "tenant_id" text REFERENCES "dripiq_app"."tenants"("id") ON DELETE CASCADE,
  "status" text NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'rolled_back')),
  "details" jsonb,
  "executed_at" timestamp NOT NULL DEFAULT NOW(),
  "completed_at" timestamp,
  "error_message" text
);

CREATE INDEX "migration_audit_log_migration_name_idx" ON "dripiq_app"."migration_audit_log"("migration_name");
CREATE INDEX "migration_audit_log_tenant_id_idx" ON "dripiq_app"."migration_audit_log"("tenant_id");
CREATE INDEX "migration_audit_log_status_idx" ON "dripiq_app"."migration_audit_log"("status");
```

### **TypeScript Migration Scripts**

#### **Main Migration Script**
**File:** `server/src/db/migration-scripts/migrate-sendgrid-configs.ts`

```typescript
import { db } from '@/db';
import { 
  emailProviderConfigs, 
  emailSenderIdentities, 
  tenants,
  migrationAuditLog 
} from '@/db/schema';
import { eq, and, isNull, isNotNull } from 'drizzle-orm';
import { logger } from '@/libs/logger';
import { createId } from '@paralleldrive/cuid2';

interface MigrationResult {
  success: boolean;
  tenantsMigrated: number;
  identitiesMigrated: number;
  errors: string[];
}

export class SendGridMigrationService {
  /**
   * Migrate existing SendGrid configurations to new provider system
   */
  static async migrateSendGridConfigurations(): Promise<MigrationResult> {
    const startTime = Date.now();
    logger.info('[SendGridMigration] Starting SendGrid configuration migration');

    const result: MigrationResult = {
      success: false,
      tenantsMigrated: 0,
      identitiesMigrated: 0,
      errors: [],
    };

    try {
      // Step 1: Find tenants with SendGrid sender identities that need migration
      const tenantsToMigrate = await this.findTenantsNeedingMigration();
      
      logger.info('[SendGridMigration] Found tenants needing migration', {
        count: tenantsToMigrate.length,
        tenantIds: tenantsToMigrate.map(t => t.id),
      });

      // Step 2: Migrate each tenant
      for (const tenant of tenantsToMigrate) {
        try {
          await this.migrateTenant(tenant.id);
          result.tenantsMigrated++;
        } catch (error) {
          const errorMessage = `Failed to migrate tenant ${tenant.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMessage);
          logger.error('[SendGridMigration] Tenant migration failed', {
            tenantId: tenant.id,
            error: errorMessage,
          });
        }
      }

      // Step 3: Count total migrated identities
      result.identitiesMigrated = await this.countMigratedIdentities();

      // Step 4: Validate migration
      const validationResult = await this.validateMigration();
      if (!validationResult.isValid) {
        result.errors.push(...validationResult.errors);
      }

      result.success = result.errors.length === 0;

      const duration = Date.now() - startTime;
      logger.info('[SendGridMigration] Migration completed', {
        success: result.success,
        tenantsMigrated: result.tenantsMigrated,
        identitiesMigrated: result.identitiesMigrated,
        errors: result.errors,
        durationMs: duration,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMessage);
      
      logger.error('[SendGridMigration] Migration failed', {
        error: errorMessage,
        result,
      });

      return result;
    }
  }

  /**
   * Find tenants that have SendGrid sender identities but no provider configs
   */
  private static async findTenantsNeedingMigration() {
    return await db
      .select({ id: tenants.id, name: tenants.name })
      .from(tenants)
      .where(
        and(
          // Tenant has sender identities with SendGrid IDs
          exists(
            db
              .select({ id: emailSenderIdentities.id })
              .from(emailSenderIdentities)
              .where(
                and(
                  eq(emailSenderIdentities.tenantId, tenants.id),
                  isNotNull(emailSenderIdentities.sendgridSenderId)
                )
              )
          ),
          // Tenant doesn't have any provider configs yet
          notExists(
            db
              .select({ id: emailProviderConfigs.id })
              .from(emailProviderConfigs)
              .where(eq(emailProviderConfigs.tenantId, tenants.id))
          )
        )
      );
  }

  /**
   * Migrate a single tenant's SendGrid configuration
   */
  private static async migrateTenant(tenantId: string): Promise<void> {
    logger.info('[SendGridMigration] Migrating tenant', { tenantId });

    // Start audit log entry
    const auditId = await this.createAuditLogEntry(tenantId, 'started');

    try {
      // Step 1: Create default SendGrid provider config
      const providerConfig = await db
        .insert(emailProviderConfigs)
        .values({
          id: createId(),
          tenantId,
          type: 'sendgrid',
          name: 'SendGrid (Migrated)',
          config: {
            legacy: true,
            migrated_at: new Date().toISOString(),
            api_key_ref: 'SENDGRID_API_KEY', // Reference to environment variable
          },
          isDefault: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      const configId = providerConfig[0]?.id;
      if (!configId) {
        throw new Error('Failed to create provider config');
      }

      // Step 2: Find sender identities to migrate
      const identities = await db
        .select()
        .from(emailSenderIdentities)
        .where(
          and(
            eq(emailSenderIdentities.tenantId, tenantId),
            isNotNull(emailSenderIdentities.sendgridSenderId),
            isNull(emailSenderIdentities.providerConfigId)
          )
        );

      // Step 3: Update sender identities
      let updatedCount = 0;
      for (const identity of identities) {
        await db
          .update(emailSenderIdentities)
          .set({
            providerConfigId: configId,
            providerValidationData: {
              sendgrid_sender_id: identity.sendgridSenderId,
              migrated_at: new Date().toISOString(),
              legacy_validation: true,
            },
            updatedAt: new Date(),
          })
          .where(eq(emailSenderIdentities.id, identity.id));
        
        updatedCount++;
      }

      // Complete audit log entry
      await this.updateAuditLogEntry(auditId, 'completed', {
        migrated_identities: updatedCount,
        created_provider_config: true,
        provider_config_id: configId,
      });

      logger.info('[SendGridMigration] Tenant migration completed', {
        tenantId,
        identitiesMigrated: updatedCount,
        providerConfigId: configId,
      });
    } catch (error) {
      // Update audit log with error
      await this.updateAuditLogEntry(auditId, 'failed', null, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Validate the migration results
   */
  private static async validateMigration(): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Check 1: All tenants with SendGrid identities should have provider configs
      const tenantsWithoutConfigs = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(
          and(
            exists(
              db
                .select({ id: emailSenderIdentities.id })
                .from(emailSenderIdentities)
                .where(
                  and(
                    eq(emailSenderIdentities.tenantId, tenants.id),
                    isNotNull(emailSenderIdentities.sendgridSenderId)
                  )
                )
            ),
            notExists(
              db
                .select({ id: emailProviderConfigs.id })
                .from(emailProviderConfigs)
                .where(eq(emailProviderConfigs.tenantId, tenants.id))
            )
          )
        );

      if (tenantsWithoutConfigs.length > 0) {
        errors.push(`${tenantsWithoutConfigs.length} tenants still missing provider configs`);
      }

      // Check 2: All SendGrid identities should have provider config references
      const identitiesWithoutConfigs = await db
        .select({ id: emailSenderIdentities.id })
        .from(emailSenderIdentities)
        .where(
          and(
            isNotNull(emailSenderIdentities.sendgridSenderId),
            isNull(emailSenderIdentities.providerConfigId)
          )
        );

      if (identitiesWithoutConfigs.length > 0) {
        errors.push(`${identitiesWithoutConfigs.length} sender identities still missing provider config references`);
      }

      // Check 3: All migrated configs should be valid
      const invalidConfigs = await db
        .select({ id: emailProviderConfigs.id })
        .from(emailProviderConfigs)
        .where(
          and(
            eq(emailProviderConfigs.type, 'sendgrid'),
            eq(emailProviderConfigs.name, 'SendGrid (Migrated)'),
            eq(emailProviderConfigs.isActive, false)
          )
        );

      if (invalidConfigs.length > 0) {
        errors.push(`${invalidConfigs.length} migrated configs are inactive`);
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    } catch (error) {
      errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { isValid: false, errors };
    }
  }

  /**
   * Count total migrated identities
   */
  private static async countMigratedIdentities(): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(emailSenderIdentities)
      .where(
        and(
          isNotNull(emailSenderIdentities.sendgridSenderId),
          isNotNull(emailSenderIdentities.providerConfigId)
        )
      );

    return result[0]?.count || 0;
  }

  /**
   * Create audit log entry
   */
  private static async createAuditLogEntry(
    tenantId: string, 
    status: string
  ): Promise<string> {
    const result = await db
      .insert(migrationAuditLog)
      .values({
        id: createId(),
        migrationName: 'sendgrid_provider_migration',
        tenantId,
        status,
        executedAt: new Date(),
      })
      .returning();

    return result[0]?.id || '';
  }

  /**
   * Update audit log entry
   */
  private static async updateAuditLogEntry(
    auditId: string,
    status: string,
    details?: any,
    errorMessage?: string
  ): Promise<void> {
    await db
      .update(migrationAuditLog)
      .set({
        status,
        details,
        errorMessage,
        completedAt: new Date(),
      })
      .where(eq(migrationAuditLog.id, auditId));
  }

  /**
   * Rollback migration for a specific tenant
   */
  static async rollbackTenantMigration(tenantId: string): Promise<void> {
    logger.info('[SendGridMigration] Rolling back tenant migration', { tenantId });

    const auditId = await this.createAuditLogEntry(tenantId, 'rolling_back');

    try {
      // Step 1: Reset sender identities
      await db
        .update(emailSenderIdentities)
        .set({
          providerConfigId: null,
          providerValidationData: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(emailSenderIdentities.tenantId, tenantId),
            isNotNull(emailSenderIdentities.sendgridSenderId)
          )
        );

      // Step 2: Remove migrated provider configs
      await db
        .delete(emailProviderConfigs)
        .where(
          and(
            eq(emailProviderConfigs.tenantId, tenantId),
            eq(emailProviderConfigs.type, 'sendgrid'),
            eq(emailProviderConfigs.name, 'SendGrid (Migrated)')
          )
        );

      await this.updateAuditLogEntry(auditId, 'rolled_back', {
        rollback_completed: true,
      });

      logger.info('[SendGridMigration] Tenant migration rollback completed', { tenantId });
    } catch (error) {
      await this.updateAuditLogEntry(auditId, 'failed', null, error instanceof Error ? error.message : 'Rollback failed');
      throw error;
    }
  }
}

// Helper functions for SQL operations
function exists(subquery: any) {
  return sql`EXISTS (${subquery})`;
}

function notExists(subquery: any) {
  return sql`NOT EXISTS (${subquery})`;
}

function count() {
  return sql<number>`count(*)`;
}
```

#### **Migration Validation Script**
**File:** `server/src/db/migration-scripts/validate-migration.ts`

```typescript
import { db } from '@/db';
import { 
  emailProviderConfigs, 
  emailSenderIdentities, 
  tenants 
} from '@/db/schema';
import { eq, and, isNull, isNotNull } from 'drizzle-orm';
import { logger } from '@/libs/logger';

interface ValidationReport {
  isValid: boolean;
  totalTenants: number;
  tenantsWithSendGrid: number;
  tenantsMigrated: number;
  totalIdentities: number;
  identitiesMigrated: number;
  issues: Array<{
    type: 'warning' | 'error';
    message: string;
    count?: number;
    details?: any;
  }>;
}

export class MigrationValidator {
  /**
   * Comprehensive validation of the SendGrid migration
   */
  static async validateSendGridMigration(): Promise<ValidationReport> {
    logger.info('[MigrationValidator] Starting migration validation');

    const report: ValidationReport = {
      isValid: true,
      totalTenants: 0,
      tenantsWithSendGrid: 0,
      tenantsMigrated: 0,
      totalIdentities: 0,
      identitiesMigrated: 0,
      issues: [],
    };

    try {
      // Get basic counts
      await this.getBasicCounts(report);
      
      // Check for unmigrated tenants
      await this.checkUnmigratedTenants(report);
      
      // Check for unmigrated identities
      await this.checkUnmigratedIdentities(report);
      
      // Check for orphaned configurations
      await this.checkOrphanedConfigurations(report);
      
      // Check for data consistency
      await this.checkDataConsistency(report);
      
      // Check for duplicate configurations
      await this.checkDuplicateConfigurations(report);

      // Determine if migration is valid
      report.isValid = !report.issues.some(issue => issue.type === 'error');

      logger.info('[MigrationValidator] Validation completed', {
        isValid: report.isValid,
        issueCount: report.issues.length,
        errorCount: report.issues.filter(i => i.type === 'error').length,
        warningCount: report.issues.filter(i => i.type === 'warning').length,
      });

      return report;
    } catch (error) {
      report.issues.push({
        type: 'error',
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      report.isValid = false;
      return report;
    }
  }

  private static async getBasicCounts(report: ValidationReport): Promise<void> {
    // Total tenants
    const totalTenants = await db.select({ count: count() }).from(tenants);
    report.totalTenants = totalTenants[0]?.count || 0;

    // Tenants with SendGrid identities
    const tenantsWithSendGrid = await db
      .selectDistinct({ tenantId: emailSenderIdentities.tenantId })
      .from(emailSenderIdentities)
      .where(isNotNull(emailSenderIdentities.sendgridSenderId));
    report.tenantsWithSendGrid = tenantsWithSendGrid.length;

    // Tenants with migrated configurations
    const tenantsMigrated = await db
      .selectDistinct({ tenantId: emailProviderConfigs.tenantId })
      .from(emailProviderConfigs)
      .where(
        and(
          eq(emailProviderConfigs.type, 'sendgrid'),
          eq(emailProviderConfigs.name, 'SendGrid (Migrated)')
        )
      );
    report.tenantsMigrated = tenantsMigrated.length;

    // Total SendGrid identities
    const totalIdentities = await db
      .select({ count: count() })
      .from(emailSenderIdentities)
      .where(isNotNull(emailSenderIdentities.sendgridSenderId));
    report.totalIdentities = totalIdentities[0]?.count || 0;

    // Migrated identities
    const identitiesMigrated = await db
      .select({ count: count() })
      .from(emailSenderIdentities)
      .where(
        and(
          isNotNull(emailSenderIdentities.sendgridSenderId),
          isNotNull(emailSenderIdentities.providerConfigId)
        )
      );
    report.identitiesMigrated = identitiesMigrated[0]?.count || 0;
  }

  private static async checkUnmigratedTenants(report: ValidationReport): Promise<void> {
    const unmigratedTenants = await db
      .select({ 
        id: tenants.id, 
        name: tenants.name,
        identityCount: count(emailSenderIdentities.id)
      })
      .from(tenants)
      .leftJoin(emailSenderIdentities, eq(tenants.id, emailSenderIdentities.tenantId))
      .leftJoin(emailProviderConfigs, eq(tenants.id, emailProviderConfigs.tenantId))
      .where(
        and(
          isNotNull(emailSenderIdentities.sendgridSenderId),
          isNull(emailProviderConfigs.id)
        )
      )
      .groupBy(tenants.id, tenants.name);

    if (unmigratedTenants.length > 0) {
      report.issues.push({
        type: 'error',
        message: 'Tenants with SendGrid identities missing provider configurations',
        count: unmigratedTenants.length,
        details: unmigratedTenants,
      });
    }
  }

  private static async checkUnmigratedIdentities(report: ValidationReport): Promise<void> {
    const unmigratedIdentities = await db
      .select({
        id: emailSenderIdentities.id,
        tenantId: emailSenderIdentities.tenantId,
        fromEmail: emailSenderIdentities.fromEmail,
        sendgridSenderId: emailSenderIdentities.sendgridSenderId,
      })
      .from(emailSenderIdentities)
      .where(
        and(
          isNotNull(emailSenderIdentities.sendgridSenderId),
          isNull(emailSenderIdentities.providerConfigId)
        )
      );

    if (unmigratedIdentities.length > 0) {
      report.issues.push({
        type: 'error',
        message: 'SendGrid sender identities missing provider config references',
        count: unmigratedIdentities.length,
        details: unmigratedIdentities,
      });
    }
  }

  private static async checkOrphanedConfigurations(report: ValidationReport): Promise<void> {
    const orphanedConfigs = await db
      .select({
        id: emailProviderConfigs.id,
        tenantId: emailProviderConfigs.tenantId,
        name: emailProviderConfigs.name,
      })
      .from(emailProviderConfigs)
      .leftJoin(
        emailSenderIdentities,
        eq(emailProviderConfigs.id, emailSenderIdentities.providerConfigId)
      )
      .where(
        and(
          eq(emailProviderConfigs.type, 'sendgrid'),
          eq(emailProviderConfigs.name, 'SendGrid (Migrated)'),
          isNull(emailSenderIdentities.id)
        )
      );

    if (orphanedConfigs.length > 0) {
      report.issues.push({
        type: 'warning',
        message: 'Migrated provider configurations with no associated sender identities',
        count: orphanedConfigs.length,
        details: orphanedConfigs,
      });
    }
  }

  private static async checkDataConsistency(report: ValidationReport): Promise<void> {
    // Check for identities with provider configs but no sendgrid_sender_id
    const inconsistentIdentities = await db
      .select({
        id: emailSenderIdentities.id,
        tenantId: emailSenderIdentities.tenantId,
        fromEmail: emailSenderIdentities.fromEmail,
      })
      .from(emailSenderIdentities)
      .innerJoin(
        emailProviderConfigs,
        eq(emailSenderIdentities.providerConfigId, emailProviderConfigs.id)
      )
      .where(
        and(
          eq(emailProviderConfigs.type, 'sendgrid'),
          isNull(emailSenderIdentities.sendgridSenderId)
        )
      );

    if (inconsistentIdentities.length > 0) {
      report.issues.push({
        type: 'error',
        message: 'Sender identities with SendGrid provider configs but no SendGrid sender ID',
        count: inconsistentIdentities.length,
        details: inconsistentIdentities,
      });
    }
  }

  private static async checkDuplicateConfigurations(report: ValidationReport): Promise<void> {
    const duplicateConfigs = await db
      .select({
        tenantId: emailProviderConfigs.tenantId,
        count: count(),
      })
      .from(emailProviderConfigs)
      .where(
        and(
          eq(emailProviderConfigs.type, 'sendgrid'),
          eq(emailProviderConfigs.name, 'SendGrid (Migrated)')
        )
      )
      .groupBy(emailProviderConfigs.tenantId)
      .having(gt(count(), 1));

    if (duplicateConfigs.length > 0) {
      report.issues.push({
        type: 'error',
        message: 'Tenants with duplicate migrated SendGrid configurations',
        count: duplicateConfigs.length,
        details: duplicateConfigs,
      });
    }
  }

  /**
   * Generate a detailed migration report
   */
  static async generateMigrationReport(): Promise<string> {
    const validation = await this.validateSendGridMigration();
    
    let report = `# SendGrid Migration Validation Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n`;
    report += `**Status:** ${validation.isValid ? '✅ VALID' : '❌ INVALID'}\n\n`;
    
    report += `## Summary\n\n`;
    report += `- Total Tenants: ${validation.totalTenants}\n`;
    report += `- Tenants with SendGrid: ${validation.tenantsWithSendGrid}\n`;
    report += `- Tenants Migrated: ${validation.tenantsMigrated}\n`;
    report += `- Total SendGrid Identities: ${validation.totalIdentities}\n`;
    report += `- Identities Migrated: ${validation.identitiesMigrated}\n`;
    
    const migrationRate = validation.tenantsWithSendGrid > 0 
      ? (validation.tenantsMigrated / validation.tenantsWithSendGrid * 100).toFixed(1)
      : '0';
    report += `- Migration Rate: ${migrationRate}%\n\n`;
    
    if (validation.issues.length > 0) {
      report += `## Issues Found\n\n`;
      
      const errors = validation.issues.filter(i => i.type === 'error');
      const warnings = validation.issues.filter(i => i.type === 'warning');
      
      if (errors.length > 0) {
        report += `### Errors (${errors.length})\n\n`;
        errors.forEach((issue, index) => {
          report += `${index + 1}. **${issue.message}**\n`;
          if (issue.count) report += `   - Count: ${issue.count}\n`;
          report += `\n`;
        });
      }
      
      if (warnings.length > 0) {
        report += `### Warnings (${warnings.length})\n\n`;
        warnings.forEach((issue, index) => {
          report += `${index + 1}. **${issue.message}**\n`;
          if (issue.count) report += `   - Count: ${issue.count}\n`;
          report += `\n`;
        });
      }
    } else {
      report += `## ✅ No Issues Found\n\n`;
      report += `The migration completed successfully with no issues detected.\n`;
    }
    
    return report;
  }
}

// Helper functions
function count() {
  return sql<number>`count(*)`;
}

function gt(column: any, value: number) {
  return sql`${column} > ${value}`;
}
```

### **Rollback Procedures**
**File:** `server/src/db/migration-scripts/rollback-migration.ts`

```typescript
import { db } from '@/db';
import { 
  emailProviderConfigs, 
  emailSenderIdentities,
  migrationAuditLog 
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/libs/logger';

export class MigrationRollback {
  /**
   * Complete rollback of SendGrid migration
   */
  static async rollbackSendGridMigration(): Promise<void> {
    logger.info('[MigrationRollback] Starting complete SendGrid migration rollback');

    try {
      // Step 1: Reset all migrated sender identities
      const resetResult = await db
        .update(emailSenderIdentities)
        .set({
          providerConfigId: null,
          providerValidationData: null,
          updatedAt: new Date(),
        })
        .where(isNotNull(emailSenderIdentities.providerConfigId))
        .returning();

      logger.info('[MigrationRollback] Reset sender identities', {
        count: resetResult.length,
      });

      // Step 2: Remove all migrated provider configurations
      const deletedConfigs = await db
        .delete(emailProviderConfigs)
        .where(
          and(
            eq(emailProviderConfigs.type, 'sendgrid'),
            eq(emailProviderConfigs.name, 'SendGrid (Migrated)')
          )
        )
        .returning();

      logger.info('[MigrationRollback] Removed migrated configurations', {
        count: deletedConfigs.length,
      });

      // Step 3: Create rollback audit entries
      const tenantIds = [...new Set(deletedConfigs.map(c => c.tenantId))];
      for (const tenantId of tenantIds) {
        await db.insert(migrationAuditLog).values({
          migrationName: 'sendgrid_provider_migration',
          tenantId,
          status: 'rolled_back',
          details: {
            rollback_type: 'complete',
            rollback_timestamp: new Date().toISOString(),
          },
          executedAt: new Date(),
          completedAt: new Date(),
        });
      }

      logger.info('[MigrationRollback] Complete rollback finished successfully', {
        tenantsAffected: tenantIds.length,
        identitiesReset: resetResult.length,
        configurationsRemoved: deletedConfigs.length,
      });
    } catch (error) {
      logger.error('[MigrationRollback] Rollback failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Rollback migration for specific tenants
   */
  static async rollbackTenantsById(tenantIds: string[]): Promise<void> {
    logger.info('[MigrationRollback] Rolling back specific tenants', {
      tenantIds,
      count: tenantIds.length,
    });

    for (const tenantId of tenantIds) {
      try {
        await SendGridMigrationService.rollbackTenantMigration(tenantId);
        logger.info('[MigrationRollback] Tenant rollback completed', { tenantId });
      } catch (error) {
        logger.error('[MigrationRollback] Tenant rollback failed', {
          tenantId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    }
  }
}
```

## **Backward Compatibility Layer**

### **Legacy SendGrid Client Wrapper**
**File:** `server/src/libs/email/LegacySendGridCompatibility.ts`

```typescript
import { EmailProviderFactory } from './EmailProviderFactory';
import { sendgridClient } from './sendgrid.client';
import { logger } from '@/libs/logger';

/**
 * Compatibility layer for existing SendGrid usage
 * Gradually routes requests through new provider system
 */
export class LegacySendGridCompatibility {
  private static migrationEnabled = process.env.ENABLE_PROVIDER_MIGRATION === 'true';
  
  /**
   * Send email with automatic provider routing
   */
  static async sendEmail(
    request: any, 
    tenantId: string,
    senderIdentityId?: string
  ): Promise<any> {
    if (this.migrationEnabled && senderIdentityId) {
      try {
        // Try new provider system first
        const provider = await EmailProviderFactory.getProviderForSenderIdentity(
          senderIdentityId,
          tenantId
        );
        
        return await provider.sendEmail(request);
      } catch (error) {
        logger.warn('[LegacySendGridCompatibility] Provider system failed, falling back to legacy', {
          tenantId,
          senderIdentityId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        
        // Fallback to legacy SendGrid
        return await sendgridClient.sendEmail(request);
      }
    }
    
    // Use legacy SendGrid client
    return await sendgridClient.sendEmail(request);
  }
  
  /**
   * Check if tenant is migrated to new provider system
   */
  static async isTenantMigrated(tenantId: string): Promise<boolean> {
    try {
      await EmailProviderFactory.getProviderForTenant(tenantId);
      return true;
    } catch (error) {
      return false;
    }
  }
}
```

## **CLI Migration Tools**

### **Migration CLI Command**
**File:** `server/src/cli/commands/migrate-sendgrid.ts`

```typescript
#!/usr/bin/env tsx

import { program } from 'commander';
import { SendGridMigrationService } from '../db/migration-scripts/migrate-sendgrid-configs';
import { MigrationValidator } from '../db/migration-scripts/validate-migration';
import { MigrationRollback } from '../db/migration-scripts/rollback-migration';

program
  .name('migrate-sendgrid')
  .description('SendGrid provider migration tools')
  .version('1.0.0');

program
  .command('migrate')
  .description('Migrate SendGrid configurations to new provider system')
  .option('--dry-run', 'Show what would be migrated without making changes')
  .action(async (options) => {
    if (options.dryRun) {
      console.log('DRY RUN: Validating current state...');
      const validation = await MigrationValidator.validateSendGridMigration();
      console.log('Current state:', validation);
      return;
    }
    
    console.log('Starting SendGrid migration...');
    const result = await SendGridMigrationService.migrateSendGridConfigurations();
    
    if (result.success) {
      console.log('✅ Migration completed successfully!');
      console.log(`- Tenants migrated: ${result.tenantsMigrated}`);
      console.log(`- Identities migrated: ${result.identitiesMigrated}`);
    } else {
      console.log('❌ Migration failed with errors:');
      result.errors.forEach(error => console.log(`  - ${error}`));
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate migration state')
  .option('--report', 'Generate detailed report')
  .action(async (options) => {
    if (options.report) {
      const report = await MigrationValidator.generateMigrationReport();
      console.log(report);
    } else {
      const validation = await MigrationValidator.validateSendGridMigration();
      console.log('Validation result:', validation);
    }
  });

program
  .command('rollback')
  .description('Rollback SendGrid migration')
  .option('--tenants <ids>', 'Comma-separated tenant IDs to rollback')
  .option('--all', 'Rollback all tenants')
  .action(async (options) => {
    if (options.all) {
      console.log('Rolling back complete migration...');
      await MigrationRollback.rollbackSendGridMigration();
      console.log('✅ Complete rollback finished');
    } else if (options.tenants) {
      const tenantIds = options.tenants.split(',').map((id: string) => id.trim());
      console.log(`Rolling back tenants: ${tenantIds.join(', ')}`);
      await MigrationRollback.rollbackTenantsById(tenantIds);
      console.log('✅ Tenant rollback finished');
    } else {
      console.log('Please specify --all or --tenants <ids>');
      process.exit(1);
    }
  });

program.parse();
```

## **Testing Requirements**

### **Migration Tests**
- [ ] Test migration with various data scenarios
- [ ] Test rollback functionality
- [ ] Test validation accuracy
- [ ] Test CLI commands

### **Backward Compatibility Tests**
- [ ] Test existing SendGrid functionality still works
- [ ] Test gradual migration scenarios
- [ ] Test fallback mechanisms

## **Documentation Requirements**
- [ ] Migration procedure documentation
- [ ] Rollback procedure documentation
- [ ] Validation guide
- [ ] Troubleshooting guide

## **Definition of Done**
- [ ] Migration scripts implemented and tested
- [ ] Backward compatibility maintained
- [ ] Validation tools working correctly
- [ ] Rollback procedures tested
- [ ] CLI tools functional
- [ ] No data loss during migration
- [ ] Documentation completed
- [ ] Code review completed

## **Notes**
- Test migration thoroughly with production-like data
- Ensure rollback procedures are well-tested
- Monitor migration performance with large datasets
- Plan for gradual rollout strategy

## **Related Tickets**
- TICKET-007: Database Schema for Provider Configs (prerequisite)
- TICKET-008: Provider Config Repository (prerequisite)
- TICKET-015: Refactor EmailProcessor Integration
- TICKET-016: Update SenderIdentity Service