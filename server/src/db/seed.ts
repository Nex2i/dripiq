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

  // Seed global campaign templates
  console.log('📧 Seeding global campaign templates...');
  await seedGlobalCampaignTemplates();
  console.log('✅ Global campaign templates seeded');
}

async function seedGlobalCampaignTemplates() {
  // Check if global templates already exist
  const existingTemplates = await db.select().from(campaignTemplates).where(eq(campaignTemplates.tenantId, null));
  
  if (existingTemplates.length > 0) {
    console.log('ℹ️  Global campaign templates already exist, skipping creation');
    return;
  }

  // 12-Step Cold Leads Campaign
  const coldLeadsTemplate = await createGlobalCampaignTemplate({
    name: 'Cold Leads Nurture - 12 Step Email Series',
    description: '12-step email sequence to warm up and convert cold leads into prospects',
    steps: [
      {
        stepName: 'Welcome & Introduction',
        channel: 'email',
        config: {
          subject: 'Welcome to {{companyName}} - Let\'s get started!',
          body: `Hi {{firstName}},

Welcome to {{companyName}}! I'm excited to have you join our community.

Over the next few weeks, I'll be sharing valuable insights and resources that can help you {{primaryGoal}}.

Best regards,
{{senderName}}`
        },
        delayAfterPrevious: '0'
      },
      {
        stepName: 'Value Proposition',
        channel: 'email',
        config: {
          subject: 'Here\'s how we can help you {{primaryGoal}}',
          body: `Hi {{firstName}},

I wanted to quickly share how {{companyName}} has helped companies like yours achieve {{primaryBenefit}}.

Here are 3 key ways we make a difference:
• {{benefit1}}
• {{benefit2}}
• {{benefit3}}

Would you like to learn more about any of these?

Best,
{{senderName}}`
        },
        delayAfterPrevious: '3 days'
      },
      {
        stepName: 'Social Proof & Case Study',
        channel: 'email',
        config: {
          subject: 'How {{similarCompany}} achieved {{result}}',
          body: `Hi {{firstName}},

I thought you'd find this case study interesting...

{{similarCompany}}, a company similar to {{companyName}}, was facing {{commonChallenge}}.

After working with us for {{timeframe}}, they achieved:
• {{result1}}
• {{result2}}
• {{result3}}

I'd love to discuss how we could achieve similar results for you.

Best regards,
{{senderName}}`
        },
        delayAfterPrevious: '2 days'
      },
      {
        stepName: 'Educational Content',
        channel: 'email',
        config: {
          subject: '5 proven strategies for {{industryGoal}}',
          body: `Hi {{firstName}},

Here are 5 proven strategies that successful companies in {{industry}} use to {{industryGoal}}:

1. {{strategy1}}
2. {{strategy2}}
3. {{strategy3}}
4. {{strategy4}}
5. {{strategy5}}

Which of these resonates most with your current situation?

Best,
{{senderName}}`
        },
        delayAfterPrevious: '4 days'
      },
      {
        stepName: 'Industry Insights',
        channel: 'email',
        config: {
          subject: 'What\'s happening in {{industry}} right now',
          body: `Hi {{firstName}},

The {{industry}} landscape is changing rapidly. Here are the key trends I'm seeing:

📈 {{trend1}}
🔄 {{trend2}}
💡 {{trend3}}

How are these trends affecting {{companyName}}? I'd love to hear your perspective.

Best regards,
{{senderName}}`
        },
        delayAfterPrevious: '3 days'
      },
      {
        stepName: 'Personal Story',
        channel: 'email',
        config: {
          subject: 'My journey in {{industry}} and what I\'ve learned',
          body: `Hi {{firstName}},

I wanted to share a personal story that might resonate with you...

{{personalStory}}

This experience taught me that {{keyLearning}}, which is why I'm passionate about helping companies like {{companyName}} avoid these common pitfalls.

What challenges are you facing in your role?

Best,
{{senderName}}`
        },
        delayAfterPrevious: '5 days'
      },
      {
        stepName: 'Problem Agitation',
        channel: 'email',
        config: {
          subject: 'The hidden cost of {{commonProblem}}',
          body: `Hi {{firstName}},

Many companies underestimate the true cost of {{commonProblem}}.

Beyond the obvious impacts, here's what I often see:
• {{hiddenCost1}}
• {{hiddenCost2}}
• {{hiddenCost3}}

The good news? These issues are completely preventable with the right approach.

Is {{commonProblem}} something you're dealing with at {{companyName}}?

Best regards,
{{senderName}}`
        },
        delayAfterPrevious: '3 days'
      },
      {
        stepName: 'Solution Preview',
        channel: 'email',
        config: {
          subject: 'A better way to handle {{commonProblem}}',
          body: `Hi {{firstName}},

Following up on my last email about {{commonProblem}}...

Here's how forward-thinking companies are solving this:

🎯 {{solutionApproach}}
📊 {{measurementMethod}}
⚡ {{implementationSpeed}}

The result? {{outcomes}}.

Would you like to see how this could work for {{companyName}}?

Best,
{{senderName}}`
        },
        delayAfterPrevious: '4 days'
      },
      {
        stepName: 'Urgency & FOMO',
        channel: 'email',
        config: {
          subject: 'Don\'t let {{companyName}} fall behind in {{area}}',
          body: `Hi {{firstName}},

I've been tracking developments in {{industry}}, and companies that don't adapt to {{marketShift}} are falling behind fast.

The companies that are thriving right now all have one thing in common: {{commonSuccess}}.

At {{companyName}}, you have the opportunity to be ahead of the curve. But the window for easy implementation is closing.

Are you ready to discuss how to position {{companyName}} as a leader in this space?

Best regards,
{{senderName}}`
        },
        delayAfterPrevious: '6 days'
      },
      {
        stepName: 'Soft CTA',
        channel: 'email',
        config: {
          subject: 'Quick question about {{companyName}}\'s {{primaryFocus}}',
          body: `Hi {{firstName}},

I've been following {{companyName}} and I'm impressed by {{recentAccomplishment}}.

I have a quick question: What's your biggest priority for {{timeframe}} when it comes to {{primaryFocus}}?

I ask because I've been working with similar companies to achieve exactly that kind of goal, and I might have some insights that could be helpful.

Would you be open to a brief conversation?

Best,
{{senderName}}`
        },
        delayAfterPrevious: '5 days'
      },
      {
        stepName: 'Direct Offer',
        channel: 'email',
        config: {
          subject: 'Ready to take {{companyName}} to the next level?',
          body: `Hi {{firstName}},

Over the past few weeks, I've shared insights about {{topicArea}} and how companies like {{companyName}} can achieve {{desiredOutcome}}.

Now I'd like to make you a direct offer:

I'm offering a complimentary {{offerType}} where we'll:
✓ {{deliverable1}}
✓ {{deliverable2}}
✓ {{deliverable3}}

This usually costs {{normalPrice}}, but I'm offering it free to the right companies.

Are you interested in claiming your spot?

Best regards,
{{senderName}}`
        },
        delayAfterPrevious: '7 days'
      },
      {
        stepName: 'Final Follow-up',
        channel: 'email',
        config: {
          subject: 'Last chance: {{offer}} for {{companyName}}',
          body: `Hi {{firstName}},

This is my final email in this series.

I've enjoyed sharing insights about {{industry}} and {{topicArea}} with you over the past few weeks.

My offer for a complimentary {{offerType}} is still available, but I'm closing it to new applications after {{deadline}}.

If you're serious about {{primaryGoal}} for {{companyName}}, I'd love to explore how we can help.

Simply reply to this email or visit {{calendarLink}} to schedule a time that works for you.

Best of luck with your {{primaryGoal}} goals!

{{senderName}}`
        },
        delayAfterPrevious: '5 days'
      }
    ]
  });

  // 12-Step Lost Leads Campaign  
  const lostLeadsTemplate = await createGlobalCampaignTemplate({
    name: 'Lost Leads Re-engagement - 12 Step Email Series',
    description: '12-step email sequence to re-engage and convert lost leads who went cold',
    steps: [
      {
        stepName: 'Checking In',
        channel: 'email',
        config: {
          subject: 'Checking in - how are things at {{companyName}}?',
          body: `Hi {{firstName}},

I know it's been a while since we last connected, and I wanted to check in to see how things are going at {{companyName}}.

I remember you were focused on {{originalPriority}} - how has that been progressing?

If there's anything I can help with or if you'd like to catch up, just let me know.

Best regards,
{{senderName}}`
        },
        delayAfterPrevious: '0'
      },
      {
        stepName: 'What Changed',
        channel: 'email',
        config: {
          subject: 'Things have changed since we last spoke...',
          body: `Hi {{firstName}},

A lot has happened in {{industry}} since we last connected.

Here are the biggest changes I've seen:
• {{industryChange1}}
• {{industryChange2}}
• {{industryChange3}}

These shifts are creating new opportunities for companies like {{companyName}}.

How are these changes affecting your business?

Best,
{{senderName}}`
        },
        delayAfterPrevious: '4 days'
      },
      {
        stepName: 'New Solution/Update',
        channel: 'email',
        config: {
          subject: 'We\'ve solved the {{originalProblem}} issue',
          body: `Hi {{firstName}},

Remember when we discussed {{originalProblem}} at {{companyName}}?

I have some exciting news - we've completely revamped our approach to solving this exact issue.

Our new {{newSolution}} has helped companies achieve:
• {{newResult1}}
• {{newResult2}}
• {{newResult3}}

I thought you might be interested to hear about this development.

Would you like to see how this could apply to {{companyName}}?

Best regards,
{{senderName}}`
        },
        delayAfterPrevious: '3 days'
      },
      {
        stepName: 'Success Story',
        channel: 'email',
        config: {
          subject: 'How {{similarCompany}} overcame {{commonChallenge}}',
          body: `Hi {{firstName}},

I wanted to share a success story that reminded me of our previous conversations about {{originalChallenge}}.

{{similarCompany}} was dealing with the exact same issue. Here's what happened:

📊 The Challenge: {{challengeDescription}}
💡 The Solution: {{solutionUsed}}
🎯 The Results: {{achievedResults}}

The transformation took just {{timeframe}}, and they're now {{currentState}}.

This approach could work really well for {{companyName}} too.

Best,
{{senderName}}`
        },
        delayAfterPrevious: '5 days'
      },
      {
        stepName: 'New Opportunity',
        channel: 'email',
        config: {
          subject: 'New opportunity for {{companyName}} in {{marketArea}}',
          body: `Hi {{firstName}},

I've been analyzing the {{marketArea}} space, and I see a significant opportunity for {{companyName}}.

Here's what I'm seeing:
🔍 {{marketGap}}
📈 {{growthOpportunity}}
⚡ {{competitiveAdvantage}}

Companies that move quickly on this are seeing {{potentialResults}}.

Given {{companyName}}'s strengths in {{companyStrength}}, you're perfectly positioned to capitalize on this.

Want to explore this opportunity?

Best regards,
{{senderName}}`
        },
        delayAfterPrevious: '6 days'
      },
      {
        stepName: 'Addressing Objections',
        channel: 'email',
        config: {
          subject: 'I understand why you might be hesitant...',
          body: `Hi {{firstName}},

I've been thinking about our previous conversations, and I understand why you might have been hesitant about moving forward.

The concerns you raised about {{previousObjection}} are completely valid.

Here's how we've addressed these exact issues:
• {{objectionResponse1}}
• {{objectionResponse2}}
• {{objectionResponse3}}

Many of our most successful clients had similar concerns initially.

What would need to change for this to make sense for {{companyName}}?

Best,
{{senderName}}`
        },
        delayAfterPrevious: '4 days'
      },
      {
        stepName: 'Timing Discussion',
        channel: 'email',
        config: {
          subject: 'Is the timing better now for {{companyName}}?',
          body: `Hi {{firstName}},

When we last spoke, the timing wasn't quite right for {{companyName}} to move forward with {{originalSolution}}.

I'm curious - has anything changed that might make the timing better now?

Often I find that companies circle back to these initiatives when:
• {{timingTrigger1}}
• {{timingTrigger2}}
• {{timingTrigger3}}

If any of these apply to your current situation, it might be worth having another conversation.

What do you think?

Best regards,
{{senderName}}`
        },
        delayAfterPrevious: '7 days'
      },
      {
        stepName: 'Value Reinforcement',
        channel: 'email',
        config: {
          subject: 'The real value of solving {{originalProblem}}',
          body: `Hi {{firstName}},

I've been reflecting on the value that companies get when they properly address {{originalProblem}}.

Beyond the obvious benefits, here's what I consistently see:

💰 Financial Impact: {{financialBenefit}}
⏰ Time Savings: {{timeBenefit}}
😌 Peace of Mind: {{emotionalBenefit}}
🚀 Competitive Edge: {{strategicBenefit}}

The total value often exceeds {{totalValue}} in the first year alone.

For {{companyName}}, this could mean {{specificValue}}.

Is this something you'd like to quantify more precisely?

Best,
{{senderName}}`
        },
        delayAfterPrevious: '5 days'
      },
      {
        stepName: 'Limited Time Offer',
        channel: 'email',
        config: {
          subject: 'Special offer for {{companyName}} - expires {{deadline}}',
          body: `Hi {{firstName}},

I know we've been in touch sporadically, but I wanted to reach out with a special offer specifically for {{companyName}}.

For the next {{timeLimit}}, I'm offering:
🎁 {{specialOffer}}
💰 {{discount}}
⚡ {{bonusValue}}

This offer is only available to companies I've previously worked with, and it expires on {{deadline}}.

Given our previous conversations about {{originalGoal}}, I thought this might be the perfect opportunity to finally move forward.

Are you interested in learning more?

Best regards,
{{senderName}}`
        },
        delayAfterPrevious: '8 days'
      },
      {
        stepName: 'Urgency & Scarcity',
        channel: 'email',
        config: {
          subject: 'Only {{remainingSpots}} spots left for {{offer}}',
          body: `Hi {{firstName}},

Quick update on the special offer I mentioned for {{companyName}}...

The response has been overwhelming. We only have {{remainingSpots}} spots remaining before the {{deadline}} deadline.

I'd hate for {{companyName}} to miss out on this opportunity, especially since it could help you achieve {{desiredOutcome}}.

Here's what you'd get:
✓ {{offerComponent1}}
✓ {{offerComponent2}}
✓ {{offerComponent3}}

If you're interested, please reply as soon as possible to secure your spot.

Best,
{{senderName}}`
        },
        delayAfterPrevious: '3 days'
      },
      {
        stepName: 'Soft Close',
        channel: 'email',
        config: {
          subject: 'One simple question about {{companyName}}',
          body: `Hi {{firstName}},

I have one simple question for you:

If you could solve {{primaryChallenge}} for {{companyName}} in the next {{timeframe}}, what would that be worth to you?

I ask because I believe we have the exact solution you need, and I'd love to explore how it could work for your specific situation.

No pressure - just a genuine conversation about your goals and challenges.

Would you be open to a brief call this week?

Best regards,
{{senderName}}`
        },
        delayAfterPrevious: '6 days'
      },
      {
        stepName: 'Final Goodbye',
        channel: 'email',
        config: {
          subject: 'Goodbye from {{senderName}} (and thank you)',
          body: `Hi {{firstName}},

This will be my last email in this series.

I want to thank you for allowing me to share insights about {{industry}} and {{solutionArea}} over the past few weeks.

Even though we haven't connected directly, I hope you've found value in the information I've shared.

If your situation changes and you decide you'd like to explore how we can help {{companyName}} with {{primaryGoal}}, my door is always open.

You can reach me directly at {{directEmail}} or {{phoneNumber}}.

Wishing you and {{companyName}} continued success!

Best regards,
{{senderName}}

P.S. Feel free to forward this information to anyone else at {{companyName}} who might find it valuable.`
        },
        delayAfterPrevious: '7 days'
      }
    ]
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
