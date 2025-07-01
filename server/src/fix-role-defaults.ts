import { db } from './db/index';
import { roles, userTenants } from './db/schema';
import { eq, isNull } from 'drizzle-orm';

/**
 * Fix role_id null values by creating admin role and updating existing records
 */
async function fixRoleDefaults() {
  console.log('🔧 Fixing role_id null values...');

  try {
    // First, check if Admin role exists, if not create it
    console.log('👑 Checking for Admin role...');

    let adminRole = await db.select().from(roles).where(eq(roles.name, 'Admin')).limit(1);

    if (adminRole.length === 0) {
      console.log('📝 Creating Admin role...');
      adminRole = await db
        .insert(roles)
        .values({
          id: 'clzadmin0000000000000000',
          name: 'Admin',
          description:
            'Full access to all system features including user management, campaign oversight, and system configuration',
        })
        .returning();
      console.log('✅ Admin role created');
    } else {
      console.log('✅ Admin role already exists');
    }

    const adminRoleId = adminRole[0]?.id || 'clzadmin0000000000000000';

    // Check for user_tenants with null role_id
    console.log('🔍 Checking for null role_id values...');
    const nullRoleRecords = await db.select().from(userTenants).where(isNull(userTenants.roleId));

    if (nullRoleRecords.length > 0) {
      console.log(
        `📝 Found ${nullRoleRecords.length} records with null role_id, updating to Admin...`
      );

      const updated = await db
        .update(userTenants)
        .set({ roleId: adminRoleId })
        .where(isNull(userTenants.roleId))
        .returning();

      console.log(`✅ Updated ${updated.length} records to use Admin role`);
    } else {
      console.log('✅ No null role_id values found');
    }

    console.log('🎉 Role defaults fixed successfully!');
  } catch (error) {
    console.error('❌ Error fixing role defaults:', error);
    throw error;
  }
}

// Run the fix
if (require.main === module) {
  fixRoleDefaults()
    .then(() => {
      console.log('✅ Fix completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Fix failed:', error);
      process.exit(1);
    });
}

export { fixRoleDefaults };
