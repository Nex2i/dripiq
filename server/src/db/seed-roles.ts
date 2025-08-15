import { RoleService } from '../modules/role.service';
import { roles } from './schema';
import { db } from './index';
import { logger } from '@/libs/logger';

/**
 * Seed the database with predefined roles and permissions
 */
export async function seedRoles() {
  logger.info('🌱 Seeding roles and permissions...');

  try {
    // Check if roles already exist
    const existingRoles = await db.select().from(roles);
    if (existingRoles.length > 0) {
      logger.info('✅ Roles already exist, skipping seed');
      return;
    }

    // Define permissions for the system
    const permissionsData = [
      // Campaign permissions
      {
        name: 'campaigns:create',
        description: 'Create new campaigns',
        resource: 'campaigns',
        action: 'create',
      },
      {
        name: 'campaigns:read',
        description: 'View campaigns',
        resource: 'campaigns',
        action: 'read',
      },
      {
        name: 'campaigns:update',
        description: 'Update campaigns',
        resource: 'campaigns',
        action: 'update',
      },
      {
        name: 'campaigns:delete',
        description: 'Delete campaigns',
        resource: 'campaigns',
        action: 'delete',
      },
      {
        name: 'campaigns:manage',
        description: 'Full campaign management',
        resource: 'campaigns',
        action: 'manage',
      },

      // Lead permissions
      { name: 'leads:create', description: 'Add new leads', resource: 'leads', action: 'create' },
      { name: 'leads:read', description: 'View leads', resource: 'leads', action: 'read' },
      { name: 'leads:update', description: 'Update leads', resource: 'leads', action: 'update' },
      { name: 'leads:delete', description: 'Delete leads', resource: 'leads', action: 'delete' },
      {
        name: 'leads:manage',
        description: 'Full lead management',
        resource: 'leads',
        action: 'manage',
      },

      // User permissions
      {
        name: 'users:create',
        description: 'Create new users',
        resource: 'users',
        action: 'create',
      },
      { name: 'users:read', description: 'View users', resource: 'users', action: 'read' },
      { name: 'users:update', description: 'Update users', resource: 'users', action: 'update' },
      { name: 'users:delete', description: 'Delete users', resource: 'users', action: 'delete' },
      {
        name: 'users:manage',
        description: 'Full user management',
        resource: 'users',
        action: 'manage',
      },

      // Analytics permissions
      {
        name: 'analytics:read',
        description: 'View analytics and reports',
        resource: 'analytics',
        action: 'read',
      },

      // Settings permissions
      { name: 'settings:read', description: 'View settings', resource: 'settings', action: 'read' },
      {
        name: 'settings:update',
        description: 'Update settings',
        resource: 'settings',
        action: 'update',
      },
      {
        name: 'settings:manage',
        description: 'Full settings management',
        resource: 'settings',
        action: 'manage',
      },

      // Role permissions
      {
        name: 'roles:create',
        description: 'Create new roles',
        resource: 'roles',
        action: 'create',
      },
      { name: 'roles:read', description: 'View roles', resource: 'roles', action: 'read' },
      { name: 'roles:update', description: 'Update roles', resource: 'roles', action: 'update' },
      { name: 'roles:delete', description: 'Delete roles', resource: 'roles', action: 'delete' },
      {
        name: 'roles:manage',
        description: 'Full role management',
        resource: 'roles',
        action: 'manage',
      },
    ];

    // Create permissions
    logger.info('📋 Creating permissions...');
    const createdPermissions = [];
    for (const permData of permissionsData) {
      const permission = await RoleService.createPermission(permData);
      createdPermissions.push(permission);
      logger.info(`  ✅ Created permission: ${permission.name}`);
    }

    // Create Admin role
    logger.info('👑 Creating Admin role...');
    const adminRole = await RoleService.createRole({
      name: 'Admin',
      description:
        'Full access to all system features including user management, campaign oversight, and system configuration',
    });

    // Create Sales role
    logger.info('💼 Creating Sales role...');
    const salesRole = await RoleService.createRole({
      name: 'Sales',
      description: 'Access to campaign creation and lead management',
    });

    // Assign ALL permissions to Admin role
    logger.info('🔐 Assigning permissions to Admin role...');
    for (const permission of createdPermissions) {
      await RoleService.assignPermissionToRole(adminRole.id, permission.id);
      logger.info(`  ✅ Assigned ${permission.name} to Admin`);
    }

    // Assign specific permissions to Sales role
    logger.info('🎯 Assigning permissions to Sales role...');
    const salesPermissions = [
      'campaigns:create',
      'campaigns:read',
      'campaigns:update', // Sales can update their own campaigns
      'leads:create',
      'leads:read',
      'leads:update',
      'analytics:read', // Sales can view analytics
      'settings:read', // Sales can view basic settings
    ];

    for (const permissionName of salesPermissions) {
      const permission = createdPermissions.find((p) => p.name === permissionName);
      if (permission) {
        await RoleService.assignPermissionToRole(salesRole.id, permission.id);
        logger.info(`  ✅ Assigned ${permission.name} to Sales`);
      }
    }

    logger.info('🎉 Role seeding completed successfully!');

    // Display summary
    logger.info('\n📊 Role Summary:');
    logger.info(`Admin Role: Full access (${createdPermissions.length} permissions)`);
    logger.info(`Sales Role: Limited access (${salesPermissions.length} permissions)`);

    logger.info('\n🔍 Admin permissions:');
    logger.info('- View all campaigns and manage users');
    logger.info('- Full CRUD operations on campaigns, leads, users');
    logger.info('- Access to analytics and system settings');
    logger.info('- Role and permission management');

    logger.info('\n🎯 Sales permissions:');
    logger.info('- Setup new campaigns');
    logger.info('- Add and manage leads');
    logger.info('- View analytics and basic settings');
    logger.info('- Update their own campaigns');
  } catch (error) {
    logger.error('❌ Error seeding roles', error);
    throw error;
  }
}

// Run seed if called directly
if (require.main === module) {
  seedRoles()
    .then(() => {
      logger.info('✅ Seed completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Seed failed', error);
      process.exit(1);
    });
}
