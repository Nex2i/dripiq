import { tenants, users, userTenants } from './schema';
import { db } from './index';
import { eq } from 'drizzle-orm';
import { TenantService } from '@/modules/tenant.service';
import { seedRoles } from './seed-roles';

async function seed() {
  try {
    console.log('🌱 Starting database seed...');

    // Only clear existing data if CLEAR_DB environment variable is set
    if (process.env.CLEAR_DB === 'true') {
      console.log('🧹 Clearing existing data...');
      await db.delete(userTenants);
      await db.delete(users);
      await db.delete(tenants);
    } else {
      console.log('⚠️  Skipping data clearing (set CLEAR_DB=true to clear existing data)');
    }

    // Seed roles and permissions first
    console.log('🔐 Seeding roles and permissions...');
    await seedRoles();
    console.log('✅ Roles and permissions seeded');

    // Check if tenants already exist to avoid duplicates
    const existingTenants = await db.select().from(tenants).limit(1);

    if (existingTenants.length === 0) {
      // Create sample tenants
      console.log('🏢 Creating sample tenants...');
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
        console.log(`✅ Created tenant: ${tenant.name}`);
      }

      console.log(`✅ Created ${sampleTenants.length} tenants`);
    } else {
      console.log('ℹ️  Sample data already exists, skipping creation');
    }

    // Create seed user
    console.log('👤 Creating seed user...');
    await createSeedUser();
    console.log('✅ Seed user created');

    console.log('✅ Database seed completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

async function createSeedUser() {
  // Check if seed user already exists
  const existingSeedUser = await db
    .select()
    .from(users)
    .where(eq(users.supabaseId, 'fee55c3d-5077-41ba-8e42-a2f97c64cd92'))
    .limit(1);

  if (existingSeedUser.length > 0) {
    console.log('ℹ️  Seed user already exists, skipping creation');
    return;
  }

  // Create the seed user
  const [seedUser] = await db
    .insert(users)
    .values({
      supabaseId: 'fee55c3d-5077-41ba-8e42-a2f97c64cd92',
      email: 'ryanzhutch@gmail.com',
      name: 'Ryan Hutchinson',
      createdAt: new Date('2025-06-30T03:46:22.185Z'),
      updatedAt: new Date('2025-06-30T16:58:18.567Z'),
    })
    .returning();

  if (!seedUser) {
    console.error('❌ Failed to create seed user');
    return;
  }

  console.log('✅ Seed user created:', seedUser.email);

  // Get the first tenant to assign the user to
  const firstTenant = await db.select().from(tenants).limit(1);

  if (firstTenant.length === 0) {
    console.log('⚠️  No tenants found, skipping user-tenant assignment');
    return;
  }

  // Assign the seed user to the first tenant as admin with super user privileges
  const tenant = firstTenant[0];

  if (!tenant) {
    console.log('⚠️  Missing tenant data, skipping assignment');
    return;
  }

  // Get Admin role
  const { RoleService } = await import('@/modules/role.service');
  const adminRole = await RoleService.getRoleByName('Admin');
  
  if (!adminRole) {
    console.log('⚠️  Admin role not found, skipping user-tenant assignment');
    return;
  }

  await db.insert(userTenants).values({
    userId: seedUser.id,
    tenantId: tenant.id,
    roleId: adminRole.id,
    isSuperUser: true,
  });

  console.log(`✅ Assigned seed user to tenant "${tenant.name}" as Admin with super user privileges`);
}

// Export for external use and auto-execute
export { seed };

// Auto-execute seed when file is run
if (require.main === module) {
  seed()
    .then(() => {
      console.log('🎉 Seed completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seed failed:', error);
      process.exit(1);
    });
}
