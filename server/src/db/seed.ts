import { and, eq, sql } from 'drizzle-orm';
import { TenantService } from '@/modules/tenant.service';
import { RoleService } from '@/modules/role.service';
import { logger } from '@/libs/logger';
import { tenants, users, userTenants } from './schema';
import { seedRoles } from './seed-roles';
import { db } from './index';

async function seed() {
  try {
    logger.debug('🌱 Starting database seed...');

    // Only clear existing data if CLEAR_DB environment variable is set
    if (process.env.CLEAR_DB === 'true') {
      logger.debug('🧹 Clearing existing data...');
      await db.delete(userTenants);
      await db.delete(users);
      await db.delete(tenants);
    } else {
      logger.debug('⚠️  Skipping data clearing (set CLEAR_DB=true to clear existing data)');
    }

    // Seed roles and permissions first
    logger.debug('🔐 Seeding roles and permissions...');
    await seedRoles();
    logger.debug('✅ Roles and permissions seeded');

    // Check if tenants already exist to avoid duplicates
    const existingTenants = await db.select().from(tenants).limit(1);

    if (existingTenants.length === 0) {
      // Create sample tenants
      logger.debug('🏢 Creating sample tenants...');
      const sampleTenantData = [
        { name: 'Acme Corporation' },
        { name: 'Tech Innovations LLC' },
        { name: 'Global Solutions Inc' },
      ];

      const sampleTenants = [];

      for (const tenantData of sampleTenantData) {
        // Use TenantService to create tenant
        const tenant = await TenantService.createTenant(tenantData);
        sampleTenants.push(tenant);
        logger.debug(`✅ Created tenant: ${tenant.name}`);
      }

      logger.debug(`✅ Created ${sampleTenants.length} tenants`);
    } else {
      logger.debug('ℹ️  Sample data already exists, skipping creation');
    }

    // Create seed user
    logger.debug('👤 Creating seed user...');
    await createSeedUser();
    logger.debug('✅ Seed user created');

    logger.debug('✅ Database seed completed successfully!');
  } catch (error) {
    logger.error('❌ Error seeding database', error);
    throw error;
  }
}

async function createSeedUser() {
  const localSeedEmail = 'ryanzhutch+local@gmail.com';
  const localSupabaseId = await resolveLocalSeedSupabaseId(localSeedEmail);
  const supabaseId =
    process.env.NODE_ENV === 'production'
      ? 'fee55c3d-5077-41ba-8e42-a2f97c64cd92'
      : localSupabaseId;

  const seedUserData = [
    {
      supabaseId: 'fee55c3d-5077-41ba-8e42-a2f97c64cd92',
      email: `ryanzhutch+production@gmail.com`,
      name: 'Ryan Prod',
      createdAt: new Date('2025-06-30T03:46:22.185Z'),
      updatedAt: new Date('2025-06-30T16:58:18.567Z'),
    },
    {
      supabaseId: localSupabaseId,
      email: localSeedEmail,
      name: 'Ryan Local',
      createdAt: new Date('2025-06-30T03:46:22.185Z'),
      updatedAt: new Date('2025-06-30T16:58:18.567Z'),
    },
  ];

  await db
    .insert(users)
    .values(seedUserData)
    .onConflictDoUpdate({
      target: users.email,
      set: {
        supabaseId: sql`excluded.supabase_id`,
        name: sql`excluded.name`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

  const [seedUser] = await db
    .select()
    .from(users)
    .where(eq(users.supabaseId, supabaseId))
    .limit(1);

  if (!seedUser) {
    logger.error('❌ Failed to resolve seed user', { supabaseId });
    return;
  }

  logger.debug('✅ Seed user resolved', { email: seedUser.email });

  // Get the first tenant to assign the user to
  const firstTenant = await db.select().from(tenants).limit(1);

  if (firstTenant.length === 0) {
    logger.debug('⚠️  No tenants found, skipping user-tenant assignment');
    return;
  }

  // Assign the seed user to the first tenant as admin with super user privileges
  const tenant = firstTenant[0];

  if (!tenant) {
    logger.debug('⚠️  Missing tenant data, skipping assignment');
    return;
  }

  // Get Admin role
  const adminRole = await RoleService.getRoleByName('Admin');

  if (!adminRole) {
    logger.debug('⚠️  Admin role not found, skipping user-tenant assignment');
    return;
  }

  const existingUserTenant = await db
    .select()
    .from(userTenants)
    .where(and(eq(userTenants.userId, seedUser.id), eq(userTenants.tenantId, tenant.id)))
    .limit(1);

  if (existingUserTenant.length > 0) {
    logger.debug('ℹ️  Seed user tenant assignment already exists, skipping creation');
    return;
  }

  await db.insert(userTenants).values({
    userId: seedUser.id,
    tenantId: tenant.id,
    roleId: adminRole.id,
    isSuperUser: true,
  });

  logger.debug(
    `✅ Assigned seed user to tenant "${tenant.name}" as Admin with super user privileges`
  );
}

async function resolveLocalSeedSupabaseId(email: string) {
  const authUsers = await db.execute<{ id: string }>(sql`
    select id::text as id
    from auth.users
    where lower(email) = lower(${email})
    limit 1
  `);

  return authUsers[0]?.id || '91d39f85-07b7-4ae7-8da9-b4e4e675ce55';
}

// Export for external use and auto-execute
export { seed };

// Auto-execute seed when file is run
if (require.main === module) {
  seed()
    .then(() => {
      logger.debug('🎉 Seed completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Seed failed', error);
      process.exit(1);
    });
}
