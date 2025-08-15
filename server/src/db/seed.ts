import { eq } from 'drizzle-orm';
import { TenantService } from '@/modules/tenant.service';
import { RoleService } from '@/modules/role.service';
import { logger } from '@/libs/logger';
import { tenants, users, userTenants } from './schema';
import { seedRoles } from './seed-roles';
import { db } from './index';

async function seed() {
  try {
    logger.info('🌱 Starting database seed...');

    // Only clear existing data if CLEAR_DB environment variable is set
    if (process.env.CLEAR_DB === 'true') {
      logger.info('🧹 Clearing existing data...');
      await db.delete(userTenants);
      await db.delete(users);
      await db.delete(tenants);
    } else {
      logger.info('⚠️  Skipping data clearing (set CLEAR_DB=true to clear existing data)');
    }

    // Seed roles and permissions first
    logger.info('🔐 Seeding roles and permissions...');
    await seedRoles();
    logger.info('✅ Roles and permissions seeded');

    // Check if tenants already exist to avoid duplicates
    const existingTenants = await db.select().from(tenants).limit(1);

    if (existingTenants.length === 0) {
      // Create sample tenants
      logger.info('🏢 Creating sample tenants...');
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
        logger.info(`✅ Created tenant: ${tenant.name}`);
      }

      logger.info(`✅ Created ${sampleTenants.length} tenants`);
    } else {
      logger.info('ℹ️  Sample data already exists, skipping creation');
    }

    // Create seed user
    logger.info('👤 Creating seed user...');
    await createSeedUser();
    logger.info('✅ Seed user created');

    logger.info('✅ Database seed completed successfully!');
  } catch (error) {
    logger.error('❌ Error seeding database', error);
    throw error;
  }
}

async function createSeedUser() {
  // Check if seed user already exists
  const supabaseId =
    process.env.NODE_ENV === 'production'
      ? 'fee55c3d-5077-41ba-8e42-a2f97c64cd92'
      : '91d39f85-07b7-4ae7-8da9-b4e4e675ce55';
  const existingSeedUser = await db
    .select()
    .from(users)
    .where(eq(users.supabaseId, supabaseId))
    .limit(1);

  if (existingSeedUser.length > 0) {
    logger.info('ℹ️  Seed user already exists, skipping creation');
    return;
  }

  // Create the seed user
  const [seedUser] = await db
    .insert(users)
    .values([
      {
        supabaseId: 'fee55c3d-5077-41ba-8e42-a2f97c64cd92',
        email: `ryanzhutch+production@gmail.com`,
        name: 'Ryan Prod',
        createdAt: new Date('2025-06-30T03:46:22.185Z'),
        updatedAt: new Date('2025-06-30T16:58:18.567Z'),
      },
      {
        supabaseId: '91d39f85-07b7-4ae7-8da9-b4e4e675ce55',
        email: `ryanzhutch+local@gmail.com`,
        name: 'Ryan Local',
        createdAt: new Date('2025-06-30T03:46:22.185Z'),
        updatedAt: new Date('2025-06-30T16:58:18.567Z'),
      },
    ])
    .returning();

  if (!seedUser) {
    logger.error('❌ Failed to create seed user');
    return;
  }

  logger.info('✅ Seed user created', { email: seedUser.email });

  // Get the first tenant to assign the user to
  const firstTenant = await db.select().from(tenants).limit(1);

  if (firstTenant.length === 0) {
    logger.info('⚠️  No tenants found, skipping user-tenant assignment');
    return;
  }

  // Assign the seed user to the first tenant as admin with super user privileges
  const tenant = firstTenant[0];

  if (!tenant) {
    logger.info('⚠️  Missing tenant data, skipping assignment');
    return;
  }

  // Get Admin role
  const adminRole = await RoleService.getRoleByName('Admin');

  if (!adminRole) {
    logger.info('⚠️  Admin role not found, skipping user-tenant assignment');
    return;
  }

  await db.insert(userTenants).values({
    userId: seedUser.id,
    tenantId: tenant.id,
    roleId: adminRole.id,
    isSuperUser: true,
  });

  logger.info(
    `✅ Assigned seed user to tenant "${tenant.name}" as Admin with super user privileges`
  );
}

// Export for external use and auto-execute
export { seed };

// Auto-execute seed when file is run
if (require.main === module) {
  seed()
    .then(() => {
      logger.info('🎉 Seed completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Seed failed', error);
      process.exit(1);
    });
}
