import { eq, isNull } from 'drizzle-orm';
import { TenantService } from '@/modules/tenant.service';
import { RoleService } from '@/modules/role.service';
import { createGlobalCampaignTemplate } from '@/modules/campaign.service';
import { tenants, users, userTenants, campaignTemplates } from './schema';
import { seedRoles } from './seed-roles';
import { db } from './index';

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

    // Seed global campaign templates
    console.log('📧 Seeding global campaign templates...');
    await seedGlobalCampaignTemplates();
    console.log('✅ Global campaign templates seeded');

    console.log('✅ Database seed completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
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
    console.log('ℹ️  Seed user already exists, skipping creation');
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

  console.log(
    `✅ Assigned seed user to tenant "${tenant.name}" as Admin with super user privileges`
  );
}

async function seedGlobalCampaignTemplates() {
  // Check if global templates already exist
  const existingTemplates = await db
    .select()
    .from(campaignTemplates)
    .where(isNull(campaignTemplates.tenantId));

  if (existingTemplates.length > 0) {
    console.log('ℹ️  Global campaign templates already exist, skipping creation');
    return;
  }

  // 12-Step Cold Leads Campaign
  const coldLeadsTemplate = await createGlobalCampaignTemplate({
    name: 'Cold Leads Nurture - 12 Step Email Series',
    description:
      '12-step email sequence structure to warm up and convert cold leads into prospects',
    steps: [
      {
        stepName: 'Welcome & Introduction',
        channel: 'email',
        delayAfterPrevious: '0',
      },
      {
        stepName: 'Value Proposition',
        channel: 'email',
        delayAfterPrevious: '3 days',
      },
      {
        stepName: 'Social Proof & Case Study',
        channel: 'email',
        delayAfterPrevious: '2 days',
      },
      {
        stepName: 'Educational Content',
        channel: 'email',
        delayAfterPrevious: '4 days',
      },
      {
        stepName: 'Industry Insights',
        channel: 'email',
        delayAfterPrevious: '3 days',
      },
      {
        stepName: 'Personal Story',
        channel: 'email',
        delayAfterPrevious: '5 days',
      },
      {
        stepName: 'Problem Agitation',
        channel: 'email',
        delayAfterPrevious: '3 days',
      },
      {
        stepName: 'Solution Preview',
        channel: 'email',
        delayAfterPrevious: '4 days',
      },
      {
        stepName: 'Urgency & FOMO',
        channel: 'email',
        delayAfterPrevious: '6 days',
      },
      {
        stepName: 'Soft CTA',
        channel: 'email',
        delayAfterPrevious: '5 days',
      },
      {
        stepName: 'Direct Offer',
        channel: 'email',
        delayAfterPrevious: '7 days',
      },
      {
        stepName: 'Final Follow-up',
        channel: 'email',
        delayAfterPrevious: '5 days',
      },
    ],
  });

  // 12-Step Lost Leads Campaign
  const lostLeadsTemplate = await createGlobalCampaignTemplate({
    name: 'Lost Leads Re-engagement - 12 Step Email Series',
    description:
      '12-step email sequence structure to re-engage and convert lost leads who went cold',
    steps: [
      {
        stepName: 'Checking In',
        channel: 'email',
        delayAfterPrevious: '0',
      },
      {
        stepName: 'What Changed',
        channel: 'email',
        delayAfterPrevious: '4 days',
      },
      {
        stepName: 'New Solution/Update',
        channel: 'email',
        delayAfterPrevious: '3 days',
      },
      {
        stepName: 'Success Story',
        channel: 'email',
        delayAfterPrevious: '5 days',
      },
      {
        stepName: 'New Opportunity',
        channel: 'email',
        delayAfterPrevious: '6 days',
      },
      {
        stepName: 'Addressing Objections',
        channel: 'email',
        delayAfterPrevious: '4 days',
      },
      {
        stepName: 'Timing Discussion',
        channel: 'email',
        delayAfterPrevious: '7 days',
      },
      {
        stepName: 'Value Reinforcement',
        channel: 'email',
        delayAfterPrevious: '5 days',
      },
      {
        stepName: 'Limited Time Offer',
        channel: 'email',
        delayAfterPrevious: '8 days',
      },
      {
        stepName: 'Urgency & Scarcity',
        channel: 'email',
        delayAfterPrevious: '3 days',
      },
      {
        stepName: 'Soft Close',
        channel: 'email',
        delayAfterPrevious: '6 days',
      },
      {
        stepName: 'Final Goodbye',
        channel: 'email',
        delayAfterPrevious: '7 days',
      },
    ],
  });

  console.log(`✅ Created global template: ${coldLeadsTemplate.name}`);
  console.log(`✅ Created global template: ${lostLeadsTemplate.name}`);
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
