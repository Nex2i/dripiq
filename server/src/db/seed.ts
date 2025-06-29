import { tenants, users, userTenants } from './schema';
import { db } from './index';

async function seed() {
  try {
    console.log('🌱 Starting database seed...');

    // Clear existing data (in reverse order due to foreign key constraints)
    console.log('🧹 Clearing existing data...');
    await db.delete(userTenants);
    await db.delete(users);
    await db.delete(tenants);

    // Create sample tenants
    console.log('🏢 Creating sample tenants...');
    const sampleTenants = await db
      .insert(tenants)
      .values([
        {
          name: 'Acme Corporation',
        },
        {
          name: 'Tech Innovations LLC',
        },
        {
          name: 'Global Solutions Inc',
        },
      ])
      .returning();

    console.log(`✅ Created ${sampleTenants.length} tenants`);

    // You can add more seeding logic here as needed
    // For example, creating sample users and user-tenant relationships
    // This is just a starting point

    console.log('✅ Database seed completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

// Export for external use and auto-execute
export { seed };

// Auto-execute seed when file is run
seed()
  .then(() => {
    console.log('🎉 Seed completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Seed failed:', error);
    process.exit(1);
  });
