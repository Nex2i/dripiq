import type { CampaignPlanOutput } from '@/modules/ai/schemas/contactCampaignStrategySchema';

/**
 * Static campaign template with 10 touchpoints and up to 15 total emails.
 * This template defines the complete campaign structure including timing,
 * transitions, and flow logic. The AI will only provide subject lines and
 * bodies for the email nodes.
 */
export const STATIC_CAMPAIGN_TEMPLATE: Omit<CampaignPlanOutput, 'nodes'> & {
  nodes: Array<
    CampaignPlanOutput['nodes'][0] & {
      requiresContent?: boolean;
    }
  >;
} = {
  version: '1.0',
  timezone: 'America/Los_Angeles',
  quietHours: {
    start: '18:00',
    end: '08:00',
  },
  defaults: {
    timers: {
      no_open_after: 'PT72H',
      no_click_after: 'PT24H',
    },
  },
  startNodeId: 'email_intro',
  nodes: [
    // Touchpoint 1: Initial Introduction Email
    {
      id: 'email_intro',
      channel: 'email',
      action: 'send',
      requiresContent: true,
      schedule: { delay: 'PT0S' },
      transitions: [
        { on: 'opened', to: 'wait_intro_click', within: 'PT72H' },
        { on: 'no_open', to: 'email_followup_1', after: 'PT72H' },
      ],
    },

    // Touchpoint 2: Wait for click on intro email
    {
      id: 'wait_intro_click',
      channel: 'email',
      action: 'wait',
      transitions: [
        { on: 'clicked', to: 'stop', within: 'PT24H' },
        { on: 'no_click', to: 'email_followup_1', after: 'PT24H' },
      ],
    },

    // Touchpoint 3: First Follow-up Email (for non-openers)
    {
      id: 'email_followup_1',
      channel: 'email',
      action: 'send',
      requiresContent: true,
      schedule: { delay: 'PT0S' },
      transitions: [
        { on: 'opened', to: 'wait_followup_1_click', within: 'PT72H' },
        { on: 'no_open', to: 'email_social_proof', after: 'PT96H' },
      ],
    },

    // Touchpoint 4: Wait for click on first follow-up
    {
      id: 'wait_followup_1_click',
      channel: 'email',
      action: 'wait',
      transitions: [
        { on: 'clicked', to: 'stop', within: 'PT24H' },
        { on: 'no_click', to: 'email_social_proof', after: 'PT24H' },
      ],
    },

    // Touchpoint 5: Value-Add Email (for engaged prospects)
    {
      id: 'email_value_add_1',
      channel: 'email',
      action: 'send',
      requiresContent: true,
      schedule: { delay: 'PT0S' },
      transitions: [
        { on: 'opened', to: 'wait_value_add_click', within: 'PT72H' },
        { on: 'no_open', to: 'email_roi_focused', after: 'PT72H' },
      ],
    },

    // Touchpoint 6: Wait for value-add engagement
    {
      id: 'wait_value_add_click',
      channel: 'email',
      action: 'wait',
      transitions: [
        { on: 'clicked', to: 'stop', within: 'PT48H' },
        { on: 'no_click', to: 'email_roi_focused', after: 'PT48H' },
      ],
    },

    // Touchpoint 7: Social Proof Email (for less engaged prospects)
    {
      id: 'email_social_proof',
      channel: 'email',
      action: 'send',
      requiresContent: true,
      schedule: { delay: 'PT0S' },
      transitions: [
        { on: 'opened', to: 'wait_social_proof_click', within: 'PT72H' },
        { on: 'no_open', to: 'email_problem_agitation', after: 'PT96H' },
      ],
    },

    // Touchpoint 8: Wait for social proof engagement
    {
      id: 'wait_social_proof_click',
      channel: 'email',
      action: 'wait',
      transitions: [
        { on: 'clicked', to: 'stop', within: 'PT24H' },
        { on: 'no_click', to: 'email_problem_agitation', after: 'PT24H' },
      ],
    },

    // Touchpoint 9: ROI-Focused Email
    {
      id: 'email_roi_focused',
      channel: 'email',
      action: 'send',
      requiresContent: true,
      schedule: { delay: 'PT0S' },
      transitions: [
        { on: 'opened', to: 'wait_roi_click', within: 'PT72H' },
        { on: 'no_open', to: 'email_urgency_scarcity', after: 'PT72H' },
      ],
    },

    // Touchpoint 10: Wait for ROI engagement
    {
      id: 'wait_roi_click',
      channel: 'email',
      action: 'wait',
      transitions: [
        { on: 'clicked', to: 'stop', within: 'PT24H' },
        { on: 'no_click', to: 'email_urgency_scarcity', after: 'PT24H' },
      ],
    },

    // Additional Email: Problem Agitation (for persistent non-engagers)
    {
      id: 'email_problem_agitation',
      channel: 'email',
      action: 'send',
      requiresContent: true,
      schedule: { delay: 'PT0S' },
      transitions: [
        { on: 'opened', to: 'wait_problem_click', within: 'PT72H' },
        { on: 'no_open', to: 'email_breakup', after: 'PT96H' },
      ],
    },

    // Wait for problem agitation engagement
    {
      id: 'wait_problem_click',
      channel: 'email',
      action: 'wait',
      transitions: [
        { on: 'clicked', to: 'stop', within: 'PT24H' },
        { on: 'no_click', to: 'email_breakup', after: 'PT24H' },
      ],
    },

    // Additional Email: Urgency/Scarcity
    {
      id: 'email_urgency_scarcity',
      channel: 'email',
      action: 'send',
      requiresContent: true,
      schedule: { delay: 'PT0S' },
      transitions: [
        { on: 'opened', to: 'wait_urgency_click', within: 'PT48H' },
        { on: 'no_open', to: 'email_last_chance', after: 'PT48H' },
      ],
    },

    // Wait for urgency engagement
    {
      id: 'wait_urgency_click',
      channel: 'email',
      action: 'wait',
      transitions: [
        { on: 'clicked', to: 'stop', within: 'PT24H' },
        { on: 'no_click', to: 'email_last_chance', after: 'PT24H' },
      ],
    },

    // Additional Email: Direct Ask (for engaged prospects)
    {
      id: 'email_direct_ask',
      channel: 'email',
      action: 'send',
      requiresContent: true,
      schedule: { delay: 'PT0S' },
      transitions: [
        { on: 'opened', to: 'wait_direct_ask_click', within: 'PT72H' },
        { on: 'no_open', to: 'email_last_chance', after: 'PT72H' },
      ],
    },

    // Wait for direct ask engagement
    {
      id: 'wait_direct_ask_click',
      channel: 'email',
      action: 'wait',
      transitions: [
        { on: 'clicked', to: 'stop', within: 'PT24H' },
        { on: 'no_click', to: 'email_last_chance', after: 'PT24H' },
      ],
    },

    // Additional Email: Last Chance
    {
      id: 'email_last_chance',
      channel: 'email',
      action: 'send',
      requiresContent: true,
      schedule: { delay: 'PT0S' },
      transitions: [
        { on: 'opened', to: 'wait_last_chance_click', within: 'PT72H' },
        { on: 'no_open', to: 'email_breakup', after: 'PT72H' },
      ],
    },

    // Wait for last chance engagement
    {
      id: 'wait_last_chance_click',
      channel: 'email',
      action: 'wait',
      transitions: [
        { on: 'clicked', to: 'stop', within: 'PT24H' },
        { on: 'no_click', to: 'email_breakup', after: 'PT24H' },
      ],
    },

    // Final Email: Breakup/Goodbye
    {
      id: 'email_breakup',
      channel: 'email',
      action: 'send',
      requiresContent: true,
      schedule: { delay: 'PT0S' },
      transitions: [
        { on: 'opened', to: 'stop', within: 'PT72H' },
        { on: 'no_open', to: 'stop', after: 'PT72H' },
      ],
    },

    // Stop node
    {
      id: 'stop',
      channel: 'email',
      action: 'stop',
      transitions: [],
    },
  ],
};

/**
 * List of email node IDs that require AI-generated content.
 * These are the nodes where the AI will provide subject lines and email bodies.
 */
export const EMAIL_CONTENT_NODE_IDS = STATIC_CAMPAIGN_TEMPLATE.nodes
  .filter((node) => node.requiresContent)
  .map((node) => node.id);

/**
 * Email node descriptions to help the AI understand the purpose of each email.
 */
export const EMAIL_NODE_DESCRIPTIONS = {
  email_intro: 'Initial introduction email to establish connection and generate interest',
  email_followup_1: 'First follow-up for prospects who did not open the intro email',
  email_value_add_1: 'Value-focused email with helpful insights or resources for engaged prospects',
  email_social_proof:
    'Social proof email with case studies or testimonials for less engaged prospects',
  email_roi_focused: 'ROI and business impact focused email with quantified benefits',
  email_problem_agitation: 'Problem agitation email highlighting pain points and consequences',
  email_urgency_scarcity: 'Urgency and scarcity email creating time-sensitive motivation',

  email_direct_ask: 'Direct ask email with clear call-to-action for engaged prospects',
  email_last_chance: 'Last chance email with final value proposition and urgency',
  email_breakup: 'Professional breakup email maintaining relationship for future opportunities',
} as const;

/**
 * Validates that the template has exactly 10 touchpoints and up to 15 emails.
 */
export function validateCampaignTemplate(): {
  isValid: boolean;
  touchpointCount: number;
  emailCount: number;
  errors: string[];
} {
  const errors: string[] = [];

  // Count unique touchpoints (non-wait, non-stop nodes)
  const touchpoints = STATIC_CAMPAIGN_TEMPLATE.nodes.filter(
    (node) => node.action !== 'wait' && node.action !== 'stop'
  );

  // Count email nodes
  const emailNodes = STATIC_CAMPAIGN_TEMPLATE.nodes.filter((node) => node.action === 'send');

  const touchpointCount = touchpoints.length;
  const emailCount = emailNodes.length;

  if (touchpointCount !== 10) {
    errors.push(`Expected 10 touchpoints, found ${touchpointCount}`);
  }

  if (emailCount > 15) {
    errors.push(`Expected up to 15 emails, found ${emailCount}`);
  }

  // Validate that all email nodes requiring content have descriptions
  const emailsRequiringContent = emailNodes.filter(
    (node) => 'requiresContent' in node && node.requiresContent
  );

  for (const emailNode of emailsRequiringContent) {
    if (!(emailNode.id in EMAIL_NODE_DESCRIPTIONS)) {
      errors.push(`Missing description for email node: ${emailNode.id}`);
    }
  }

  return {
    isValid: errors.length === 0,
    touchpointCount,
    emailCount,
    errors,
  };
}
