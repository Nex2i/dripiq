import type { CampaignPlanOutput } from '@/modules/ai/schemas/contactCampaignStrategySchema';

/**
 * Constants for campaign timing and events to ensure consistency
 */
export const CAMPAIGN_CONSTANTS = {
  // Timing constants
  MINIMUM_DELAY: 'PT1M', // Minimum 1 minute delay to prevent immediate execution
  DEFAULT_EMAIL_DELAY: 'PT24H', // 24 hours default delay between emails
  ENGAGEMENT_WINDOW: 'PT48H', // 2 days to wait for engagement (opens)
  CLICK_WINDOW: 'PT24H', // 1 day to wait for clicks after opens
  SHORT_ENGAGEMENT_WINDOW: 'PT48H', // 2 days for urgent emails

  // Event types
  EVENTS: {
    OPENED: 'opened',
    CLICKED: 'clicked',
    NO_OPEN: 'no_open',
    NO_CLICK: 'no_click',
  } as const,

  // Common node IDs
  NODES: {
    STOP: 'stop',
  } as const,

  // Default timers
  DEFAULT_TIMERS: {
    NO_OPEN_AFTER: 'PT72H',
    NO_CLICK_AFTER: 'PT24H',
  } as const,
} as const;

/**
 * Static campaign template with 10 touchpoints and exactly 10 emails.
 * This template defines the complete campaign structure including timing,
 * transitions, and flow logic. The AI will only provide subject lines and
 * bodies for the email nodes.
 *
 * Key features:
 * - 24-hour default delay between emails if no engagement
 * - Complete path through all emails even if never opened/clicked
 * - Consistent timing using constants
 * - No immediate (PT0S) execution to prevent race conditions
 * - No delivered transitions since no_open assumes delivery
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
      no_open_after: CAMPAIGN_CONSTANTS.DEFAULT_TIMERS.NO_OPEN_AFTER,
      no_click_after: CAMPAIGN_CONSTANTS.DEFAULT_TIMERS.NO_CLICK_AFTER,
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
      schedule: { delay: CAMPAIGN_CONSTANTS.MINIMUM_DELAY },
      transitions: [
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.OPENED,
          to: 'wait_intro_click',
          within: CAMPAIGN_CONSTANTS.ENGAGEMENT_WINDOW,
        },
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.NO_OPEN,
          to: 'email_followup_1',
          after: CAMPAIGN_CONSTANTS.DEFAULT_EMAIL_DELAY,
        },

      ],
    },

    // Touchpoint 2: Wait for click on intro email
    {
      id: 'wait_intro_click',
      channel: 'email',
      action: 'wait',
      transitions: [
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.CLICKED,
          to: 'email_value_add_1',
          within: CAMPAIGN_CONSTANTS.CLICK_WINDOW,
        },
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.NO_CLICK,
          to: 'email_followup_1',
          after: CAMPAIGN_CONSTANTS.CLICK_WINDOW,
        },
      ],
    },

    // Touchpoint 3: First Follow-up Email (for non-openers)
    {
      id: 'email_followup_1',
      channel: 'email',
      action: 'send',
      requiresContent: true,
      schedule: { delay: CAMPAIGN_CONSTANTS.MINIMUM_DELAY },
      transitions: [
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.OPENED,
          to: 'wait_followup_1_click',
          within: CAMPAIGN_CONSTANTS.ENGAGEMENT_WINDOW,
        },
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.NO_OPEN,
          to: 'email_social_proof',
          after: CAMPAIGN_CONSTANTS.DEFAULT_EMAIL_DELAY,
        },

      ],
    },

    // Touchpoint 4: Wait for click on first follow-up
    {
      id: 'wait_followup_1_click',
      channel: 'email',
      action: 'wait',
      transitions: [
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.CLICKED,
          to: 'email_value_add_1',
          within: CAMPAIGN_CONSTANTS.CLICK_WINDOW,
        },
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.NO_CLICK,
          to: 'email_social_proof',
          after: CAMPAIGN_CONSTANTS.CLICK_WINDOW,
        },
      ],
    },

    // Touchpoint 5: Value-Add Email (for engaged prospects)
    {
      id: 'email_value_add_1',
      channel: 'email',
      action: 'send',
      requiresContent: true,
      schedule: { delay: CAMPAIGN_CONSTANTS.MINIMUM_DELAY },
      transitions: [
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.OPENED,
          to: 'wait_value_add_click',
          within: CAMPAIGN_CONSTANTS.ENGAGEMENT_WINDOW,
        },
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.NO_OPEN,
          to: 'email_roi_focused',
          after: CAMPAIGN_CONSTANTS.DEFAULT_EMAIL_DELAY,
        },

      ],
    },

    // Touchpoint 6: Wait for value-add engagement
    {
      id: 'wait_value_add_click',
      channel: 'email',
      action: 'wait',
      transitions: [
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.CLICKED,
          to: 'email_direct_ask',
          within: CAMPAIGN_CONSTANTS.CLICK_WINDOW,
        },
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.NO_CLICK,
          to: 'email_roi_focused',
          after: CAMPAIGN_CONSTANTS.CLICK_WINDOW,
        },
      ],
    },

    // Touchpoint 7: Social Proof Email (for less engaged prospects)
    {
      id: 'email_social_proof',
      channel: 'email',
      action: 'send',
      requiresContent: true,
      schedule: { delay: CAMPAIGN_CONSTANTS.MINIMUM_DELAY },
      transitions: [
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.OPENED,
          to: 'wait_social_proof_click',
          within: CAMPAIGN_CONSTANTS.ENGAGEMENT_WINDOW,
        },
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.NO_OPEN,
          to: 'email_problem_agitation',
          after: CAMPAIGN_CONSTANTS.DEFAULT_EMAIL_DELAY,
        },

      ],
    },

    // Touchpoint 8: Wait for social proof engagement
    {
      id: 'wait_social_proof_click',
      channel: 'email',
      action: 'wait',
      transitions: [
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.CLICKED,
          to: 'email_roi_focused',
          within: CAMPAIGN_CONSTANTS.CLICK_WINDOW,
        },
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.NO_CLICK,
          to: 'email_problem_agitation',
          after: CAMPAIGN_CONSTANTS.CLICK_WINDOW,
        },
      ],
    },

    // Touchpoint 9: ROI-Focused Email
    {
      id: 'email_roi_focused',
      channel: 'email',
      action: 'send',
      requiresContent: true,
      schedule: { delay: CAMPAIGN_CONSTANTS.MINIMUM_DELAY },
      transitions: [
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.OPENED,
          to: 'wait_roi_click',
          within: CAMPAIGN_CONSTANTS.ENGAGEMENT_WINDOW,
        },
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.NO_OPEN,
          to: 'email_urgency_scarcity',
          after: CAMPAIGN_CONSTANTS.DEFAULT_EMAIL_DELAY,
        },

      ],
    },

    // Touchpoint 10: Wait for ROI engagement
    {
      id: 'wait_roi_click',
      channel: 'email',
      action: 'wait',
      transitions: [
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.CLICKED,
          to: 'email_direct_ask',
          within: CAMPAIGN_CONSTANTS.CLICK_WINDOW,
        },
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.NO_CLICK,
          to: 'email_urgency_scarcity',
          after: CAMPAIGN_CONSTANTS.CLICK_WINDOW,
        },
      ],
    },

    // Email: Problem Agitation (for persistent non-engagers)
    {
      id: 'email_problem_agitation',
      channel: 'email',
      action: 'send',
      requiresContent: true,
      schedule: { delay: CAMPAIGN_CONSTANTS.MINIMUM_DELAY },
      transitions: [
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.OPENED,
          to: 'wait_problem_click',
          within: CAMPAIGN_CONSTANTS.ENGAGEMENT_WINDOW,
        },
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.NO_OPEN,
          to: 'email_urgency_scarcity',
          after: CAMPAIGN_CONSTANTS.DEFAULT_EMAIL_DELAY,
        },

      ],
    },

    // Wait for problem agitation engagement
    {
      id: 'wait_problem_click',
      channel: 'email',
      action: 'wait',
      transitions: [
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.CLICKED,
          to: 'email_urgency_scarcity',
          within: CAMPAIGN_CONSTANTS.CLICK_WINDOW,
        },
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.NO_CLICK,
          to: 'email_urgency_scarcity',
          after: CAMPAIGN_CONSTANTS.CLICK_WINDOW,
        },
      ],
    },

    // Email: Urgency/Scarcity
    {
      id: 'email_urgency_scarcity',
      channel: 'email',
      action: 'send',
      requiresContent: true,
      schedule: { delay: CAMPAIGN_CONSTANTS.MINIMUM_DELAY },
      transitions: [
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.OPENED,
          to: 'wait_urgency_click',
          within: CAMPAIGN_CONSTANTS.SHORT_ENGAGEMENT_WINDOW,
        },
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.NO_OPEN,
          to: 'email_last_chance',
          after: CAMPAIGN_CONSTANTS.DEFAULT_EMAIL_DELAY,
        },

      ],
    },

    // Wait for urgency engagement
    {
      id: 'wait_urgency_click',
      channel: 'email',
      action: 'wait',
      transitions: [
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.CLICKED,
          to: 'email_direct_ask',
          within: CAMPAIGN_CONSTANTS.CLICK_WINDOW,
        },
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.NO_CLICK,
          to: 'email_last_chance',
          after: CAMPAIGN_CONSTANTS.CLICK_WINDOW,
        },
      ],
    },

    // Email: Direct Ask (for engaged prospects)
    {
      id: 'email_direct_ask',
      channel: 'email',
      action: 'send',
      requiresContent: true,
      schedule: { delay: CAMPAIGN_CONSTANTS.MINIMUM_DELAY },
      transitions: [
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.OPENED,
          to: 'wait_direct_ask_click',
          within: CAMPAIGN_CONSTANTS.ENGAGEMENT_WINDOW,
        },
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.NO_OPEN,
          to: 'email_last_chance',
          after: CAMPAIGN_CONSTANTS.DEFAULT_EMAIL_DELAY,
        },

      ],
    },

    // Wait for direct ask engagement
    {
      id: 'wait_direct_ask_click',
      channel: 'email',
      action: 'wait',
      transitions: [
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.CLICKED,
          to: CAMPAIGN_CONSTANTS.NODES.STOP,
          within: CAMPAIGN_CONSTANTS.CLICK_WINDOW,
        },
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.NO_CLICK,
          to: 'email_last_chance',
          after: CAMPAIGN_CONSTANTS.CLICK_WINDOW,
        },
      ],
    },

    // Email: Last Chance
    {
      id: 'email_last_chance',
      channel: 'email',
      action: 'send',
      requiresContent: true,
      schedule: { delay: CAMPAIGN_CONSTANTS.MINIMUM_DELAY },
      transitions: [
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.OPENED,
          to: 'wait_last_chance_click',
          within: CAMPAIGN_CONSTANTS.ENGAGEMENT_WINDOW,
        },
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.NO_OPEN,
          to: 'email_breakup',
          after: CAMPAIGN_CONSTANTS.DEFAULT_EMAIL_DELAY,
        },

      ],
    },

    // Wait for last chance engagement
    {
      id: 'wait_last_chance_click',
      channel: 'email',
      action: 'wait',
      transitions: [
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.CLICKED,
          to: CAMPAIGN_CONSTANTS.NODES.STOP,
          within: CAMPAIGN_CONSTANTS.CLICK_WINDOW,
        },
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.NO_CLICK,
          to: 'email_breakup',
          after: CAMPAIGN_CONSTANTS.CLICK_WINDOW,
        },
      ],
    },

    // Final Email: Breakup/Goodbye
    {
      id: 'email_breakup',
      channel: 'email',
      action: 'send',
      requiresContent: true,
      schedule: { delay: CAMPAIGN_CONSTANTS.MINIMUM_DELAY },
      transitions: [
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.OPENED,
          to: CAMPAIGN_CONSTANTS.NODES.STOP,
          within: CAMPAIGN_CONSTANTS.ENGAGEMENT_WINDOW,
        },
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.NO_OPEN,
          to: CAMPAIGN_CONSTANTS.NODES.STOP,
          after: CAMPAIGN_CONSTANTS.DEFAULT_EMAIL_DELAY,
        },

      ],
    },

    // Stop node
    {
      id: CAMPAIGN_CONSTANTS.NODES.STOP,
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

/**
 * Analyzes the no-open email path to ensure there's always a way through the campaign
 */
export function analyzeNoOpenPath(): {
  path: string[];
  isComplete: boolean;
  totalDelay: string;
  issues: string[];
} {
  const path: string[] = [];
  const issues: string[] = [];
  let currentNode = 'email_intro';
  const visitedNodes = new Set<string>();

  while (
    currentNode &&
    currentNode !== CAMPAIGN_CONSTANTS.NODES.STOP &&
    !visitedNodes.has(currentNode)
  ) {
    visitedNodes.add(currentNode);
    const node = STATIC_CAMPAIGN_TEMPLATE.nodes.find((n) => n.id === currentNode);

    if (!node) {
      issues.push(`Node ${currentNode} not found`);
      break;
    }

    if (node.action === 'send') {
      path.push(currentNode);
    }

    const noOpenTransition = node.transitions?.find(
      (t) => t.on === CAMPAIGN_CONSTANTS.EVENTS.NO_OPEN
    );
    if (noOpenTransition) {
      currentNode = noOpenTransition.to;

      // Validate delay is 24H for emails
      if (
        node.action === 'send' &&
        'after' in noOpenTransition &&
        noOpenTransition.after !== CAMPAIGN_CONSTANTS.DEFAULT_EMAIL_DELAY
      ) {
        issues.push(
          `${node.id} has non-standard delay: ${noOpenTransition.after} (expected ${CAMPAIGN_CONSTANTS.DEFAULT_EMAIL_DELAY})`
        );
      }
    } else {
      if (node.action === 'send' && currentNode !== 'email_breakup') {
        issues.push(`${currentNode} missing no_open transition`);
      }
      break;
    }
  }

  return {
    path,
    isComplete: currentNode === CAMPAIGN_CONSTANTS.NODES.STOP,
    totalDelay: `${path.length * 24} hours (${path.length} emails × 24h each)`,
    issues,
  };
}
