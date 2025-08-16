import {
  normalizeCampaignPlanIds,
  validatePlanReferences,
  previewIdNormalization,
  isPlanNormalized,
} from './planIdNormalizer';
import type { CampaignPlanOutput } from '../ai/schemas/contactCampaignStrategySchema';

/**
 * Demonstration of the plan ID normalizer using the provided example
 */

// Your original example plan
const originalPlan: CampaignPlanOutput = {
  version: '1.0',
  timezone: 'America/Los_Angeles',
  defaults: { timers: { no_open_after: 'PT72H', no_click_after: 'PT24H' } },
  quietHours: { start: '21:00', end: '07:30' },
  startNodeId: 'email_intro',
  nodes: [
    {
      id: 'email_intro',
      channel: 'email',
      action: 'send',
      subject: 'Introduction to our solution',
      body: 'Hi {{name}}, ...',
      schedule: { delay: 'PT0S' },
      transitions: [
        { on: 'opened', to: 'wait_click', within: 'PT72H' },
        { on: 'no_open', to: 'email_bump_1', after: 'PT72H' },
      ],
    },
    {
      id: 'wait_click',
      channel: 'email',
      action: 'wait',
      transitions: [
        { on: 'clicked', to: 'stop', within: 'PT24H' },
        { on: 'no_click', to: 'email_bump_1', after: 'PT24H' },
      ],
    },
    {
      id: 'email_bump_1',
      channel: 'email',
      action: 'send',
      subject: 'Follow-up: Did you see our solution?',
      body: 'Hi {{name}}, I wanted to follow up...',
      schedule: { delay: 'PT0S' },
      transitions: [
        { on: 'opened', to: 'stop', within: 'PT72H' },
        { on: 'no_open', to: 'stop', after: 'PT72H' },
      ],
    },
    {
      id: 'stop',
      channel: 'email',
      action: 'stop',
      transitions: [],
    },
  ],
};

export function demonstrateNormalizer() {
  console.log('🎯 Campaign Plan ID Normalizer Demo');
  console.log('=====================================\n');

  // 1. Show original plan
  console.log('📋 ORIGINAL PLAN:');
  console.log('Start Node ID:', originalPlan.startNodeId);
  console.log(
    'Node IDs:',
    originalPlan.nodes.map((n) => n.id)
  );
  console.log('Is Normalized?', isPlanNormalized(originalPlan));

  // 2. Validate original plan
  console.log('\n✅ VALIDATION (Original):');
  const originalValidation = validatePlanReferences(originalPlan);
  console.log('Is Valid?', originalValidation.isValid);
  console.log('Issues:', originalValidation.issues);

  // 3. Preview what would change
  console.log('\n🔍 PREVIEW ID CHANGES:');
  const preview = previewIdNormalization(originalPlan);
  console.log('Original Start Node:', preview.originalStartNodeId);
  console.log('New Start Node:', preview.newStartNodeId);
  console.log('ID Mappings:');
  Object.entries(preview.idMappings).forEach(([old, newId]) => {
    console.log(`  ${old} → ${newId}`);
  });

  // 4. Normalize the plan
  console.log('\n🔄 NORMALIZING PLAN...');
  const normalizedPlan = normalizeCampaignPlanIds(originalPlan);

  // 5. Show normalized plan
  console.log('\n📋 NORMALIZED PLAN:');
  console.log('Start Node ID:', normalizedPlan.startNodeId);
  console.log(
    'Node IDs:',
    normalizedPlan.nodes.map((n) => n.id)
  );
  console.log('Is Normalized?', isPlanNormalized(normalizedPlan));

  // 6. Validate normalized plan
  console.log('\n✅ VALIDATION (Normalized):');
  const normalizedValidation = validatePlanReferences(normalizedPlan);
  console.log('Is Valid?', normalizedValidation.isValid);
  console.log('Issues:', normalizedValidation.issues);

  // 7. Show that references are maintained
  console.log('\n🔗 REFERENCE INTEGRITY:');
  const startNode = normalizedPlan.nodes.find((n) => n.id === normalizedPlan.startNodeId);
  console.log('Start node found?', !!startNode);
  console.log('Start node action:', startNode?.action);

  if (startNode?.transitions) {
    console.log('Start node transitions:');
    startNode.transitions.forEach((t) => {
      const targetExists = normalizedPlan.nodes.some((n) => n.id === t.to);
      console.log(`  ${t.on} → ${t.to} (exists: ${targetExists})`);
    });
  }

  // 8. Test idempotency
  console.log('\n🔄 IDEMPOTENCY TEST:');
  const normalizedAgain = normalizeCampaignPlanIds(normalizedPlan);
  const areIdentical = JSON.stringify(normalizedPlan) === JSON.stringify(normalizedAgain);
  console.log('Normalizing twice gives same result?', areIdentical);

  console.log('\n✨ Demo completed successfully!');

  return {
    original: originalPlan,
    normalized: normalizedPlan,
    validation: normalizedValidation,
    preview,
  };
}

/**
 * Example of how to use in your campaign processing
 */
export function processRawPlanExample(rawPlan: CampaignPlanOutput) {
  console.log('\n🏭 PROCESSING RAW PLAN FROM AI:');

  // Check if already normalized (database CUIDs)
  if (isPlanNormalized(rawPlan)) {
    console.log('✅ Plan already has CUID node IDs');
    return rawPlan;
  }

  // Normalize for database storage
  console.log('🔄 Converting node IDs to CUIDs...');
  const normalizedPlan = normalizeCampaignPlanIds(rawPlan);

  // Validate the result
  const validation = validatePlanReferences(normalizedPlan);
  if (!validation.isValid) {
    console.error('❌ Plan validation failed:', validation.issues);
    throw new Error('Plan normalization resulted in invalid references');
  }

  console.log('✅ Plan normalized and validated successfully');
  console.log('📊 Stats:');
  console.log(`  - Nodes: ${normalizedPlan.nodes.length}`);
  console.log(`  - Start Node: ${normalizedPlan.startNodeId}`);
  console.log(
    `  - Total Transitions: ${normalizedPlan.nodes.reduce((sum, n) => sum + (n.transitions?.length || 0), 0)}`
  );

  return normalizedPlan;
}

// Export the demo function for use
export { originalPlan as examplePlan };
