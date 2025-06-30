import { tenants, users, userTenants, permissions, roles, rolePermissions } from './schema';
import { db } from './index';
import { eq } from 'drizzle-orm';
import { PermissionService } from '@/modules/permission.service';
import { TenantService } from '@/modules/tenant.service';

async function seed() {
  try {
    console.log('🌱 Starting database seed...');

    // Only clear existing data if CLEAR_DB environment variable is set
    if (process.env.CLEAR_DB === 'true') {
      console.log('🧹 Clearing existing data...');
      await db.delete(rolePermissions);
      await db.delete(userTenants);
      await db.delete(roles);
      await db.delete(permissions);
      await db.delete(users);
      await db.delete(tenants);
    } else {
      console.log('⚠️  Skipping data clearing (set CLEAR_DB=true to clear existing data)');
    }

    // Initialize permissions first
    console.log('🔑 Initializing permissions...');
    await PermissionService.initializeDefaultPermissions();
    console.log('✅ Permissions initialized');

    // Check if tenants already exist to avoid duplicates
    const existingTenants = await db.select().from(tenants).limit(1);

    if (existingTenants.length === 0) {
      // Create sample tenants with default roles
      console.log('🏢 Creating sample tenants...');
      const sampleTenantData = [
        { name: 'Acme Corporation' },
        { name: 'Tech Innovations LLC' },
        { name: 'Global Solutions Inc' },
      ];

      const sampleTenants = [];

      for (const tenantData of sampleTenantData) {
        // Use TenantService to create tenant which will also create default roles
        const tenant = await TenantService.createTenant(tenantData);
        sampleTenants.push(tenant);
        console.log(`✅ Created tenant: ${tenant.name} with default roles`);
      }

      console.log(`✅ Created ${sampleTenants.length} tenants with default roles`);

      // Create system roles if needed
      console.log('⚙️ Creating system roles...');
      await createSystemRoles();
      console.log('✅ System roles created');
    } else {
      console.log('ℹ️  Sample data already exists, skipping creation');

      // Still ensure permissions and system roles exist
      console.log('🔍 Checking system roles...');
      await createSystemRoles();
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

async function createSystemRoles() {
  // Check if system roles already exist
  const existingSystemRoles = await db
    .select()
    .from(roles)
    .where(eq(roles.isSystemRole, true))
    .limit(1);

  if (existingSystemRoles.length > 0) {
    console.log('ℹ️  System roles already exist, skipping creation');
    return;
  }

  // Get all permissions for super admin role
  const allPermissions = await db.select().from(permissions);

  // Create Super Admin system role
  const [superAdminRole] = await db
    .insert(roles)
    .values({
      name: 'Super Admin',
      description: 'System-wide administrator with all permissions',
      isSystemRole: true,
      tenantId: null,
    })
    .returning();

  // Assign all permissions to Super Admin
  if (superAdminRole && allPermissions.length > 0) {
    const superAdminPermissions = allPermissions.map((permission) => ({
      roleId: superAdminRole.id,
      permissionId: permission.id,
    }));

    await db.insert(rolePermissions).values(superAdminPermissions);
    console.log('✅ Super Admin role created with all permissions');
  }

  // Create Platform Manager system role
  const [platformManagerRole] = await db
    .insert(roles)
    .values({
      name: 'Platform Manager',
      description: 'Platform-level user management capabilities',
      isSystemRole: true,
      tenantId: null,
    })
    .returning();

  // Assign specific permissions to Platform Manager
  if (platformManagerRole) {
    const platformManagerPermissionNames = [
      'users:read',
      'users:create',
      'users:update',
      'users:deactivate',
      'users:invite',
      'tenants:read',
      'tenants:create',
      'tenants:update',
      'roles:read',
    ];

    const platformManagerPermissions = allPermissions
      .filter((p) => platformManagerPermissionNames.includes(p.name))
      .map((permission) => ({
        roleId: platformManagerRole.id,
        permissionId: permission.id,
      }));

    if (platformManagerPermissions.length > 0) {
      await db.insert(rolePermissions).values(platformManagerPermissions);
      console.log('✅ Platform Manager role created with management permissions');
    }
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
      isActive: true,
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

  // Get the Super Admin system role
  const superAdminRole = await db
    .select()
    .from(roles)
    .where(eq(roles.name, 'Super Admin'))
    .limit(1);

  if (superAdminRole.length === 0) {
    console.log('⚠️  Super Admin role not found, skipping role assignment');
    return;
  }

  // Assign the seed user to the first tenant with Super Admin role
  const tenant = firstTenant[0];
  const role = superAdminRole[0];

  if (!tenant || !role) {
    console.log('⚠️  Missing tenant or role data, skipping assignment');
    return;
  }

  await db.insert(userTenants).values({
    userId: seedUser.id,
    tenantId: tenant.id,
    roleId: role.id,
    isSuperUser: true,
  });

  console.log(`✅ Assigned seed user to tenant "${tenant.name}" with Super Admin role`);
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
