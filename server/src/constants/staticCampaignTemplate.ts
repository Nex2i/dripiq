import type { CampaignPlanOutput } from '@/modules/ai/schemas/contactCampaignStrategySchema';

/**
 * Constants for simplified daily email campaign
 */
export const CAMPAIGN_CONSTANTS = {
  // Timing constants
  MINIMUM_DELAY: 'PT10S', // Minimum 10 seconds delay to prevent immediate execution
  DAILY_EMAIL_DELAY: 'PT24H', // 24 hours between emails
  
  // Event types (only no_open used in MVP)
  EVENTS: {
    OPENED: 'opened',
    NO_OPEN: 'no_open',
  } as const,

  // Common node IDs
  NODES: {
    STOP: 'stop',
  } as const,

  // Default timers
  DEFAULT_TIMERS: {
    NO_OPEN_AFTER: 'PT24H', // 24 hours for no_open events
  } as const,
} as const;

/**
 * Simplified static campaign template - Daily email sequence with no_open only.
 * 
 * Each email sends the next email after 24 hours if not opened.
 * Opens are tracked but don't affect the campaign flow (MVP approach).
 * 
 * Features:
 * - 10 emails total, sent daily if no engagement
 * - Simple linear progression: Email 1 → Email 2 → ... → Email 10 → Stop
 * - No click tracking or complex branching
 * - Consistent 24-hour delays
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
    start: '23:00',
    end: '02:00',
  },
  defaults: {
    timers: {
      no_open_after: CAMPAIGN_CONSTANTS.DEFAULT_TIMERS.NO_OPEN_AFTER,
    },
  },
  startNodeId: 'email_1',
  nodes: [
    // Email 1: Initial Introduction
    {
      id: 'email_1',
      channel: 'email',
      action: 'send',
      requiresContent: true,
      schedule: { delay: CAMPAIGN_CONSTANTS.MINIMUM_DELAY },
      transitions: [
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.NO_OPEN,
          to: 'email_2',
          after: CAMPAIGN_CONSTANTS.DAILY_EMAIL_DELAY,
        },
      ],
    },

    // Email 2: Follow-up
    {
      id: 'email_2',
      channel: 'email',
      action: 'send',
      requiresContent: true,
      schedule: { delay: CAMPAIGN_CONSTANTS.MINIMUM_DELAY },
      transitions: [
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.NO_OPEN,
          to: 'email_3',
          after: CAMPAIGN_CONSTANTS.DAILY_EMAIL_DELAY,
        },
      ],
    },

    // Email 3: Value Proposition
    {
      id: 'email_3',
      channel: 'email',
      action: 'send',
      requiresContent: true,
      schedule: { delay: CAMPAIGN_CONSTANTS.MINIMUM_DELAY },
      transitions: [
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.NO_OPEN,
          to: 'email_4',
          after: CAMPAIGN_CONSTANTS.DAILY_EMAIL_DELAY,
        },
      ],
    },

    // Email 4: Social Proof
    {
      id: 'email_4',
      channel: 'email',
      action: 'send',
      requiresContent: true,
      schedule: { delay: CAMPAIGN_CONSTANTS.MINIMUM_DELAY },
      transitions: [
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.NO_OPEN,
          to: 'email_5',
          after: CAMPAIGN_CONSTANTS.DAILY_EMAIL_DELAY,
        },
      ],
    },

    // Email 5: Problem/Solution
    {
      id: 'email_5',
      channel: 'email',
      action: 'send',
      requiresContent: true,
      schedule: { delay: CAMPAIGN_CONSTANTS.MINIMUM_DELAY },
      transitions: [
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.NO_OPEN,
          to: 'email_6',
          after: CAMPAIGN_CONSTANTS.DAILY_EMAIL_DELAY,
        },
      ],
    },

    // Email 6: ROI/Benefits
    {
      id: 'email_6',
      channel: 'email',
      action: 'send',
      requiresContent: true,
      schedule: { delay: CAMPAIGN_CONSTANTS.MINIMUM_DELAY },
      transitions: [
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.NO_OPEN,
          to: 'email_7',
          after: CAMPAIGN_CONSTANTS.DAILY_EMAIL_DELAY,
        },
      ],
    },

    // Email 7: Urgency
    {
      id: 'email_7',
      channel: 'email',
      action: 'send',
      requiresContent: true,
      schedule: { delay: CAMPAIGN_CONSTANTS.MINIMUM_DELAY },
      transitions: [
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.NO_OPEN,
          to: 'email_8',
          after: CAMPAIGN_CONSTANTS.DAILY_EMAIL_DELAY,
        },
      ],
    },

    // Email 8: Direct Ask
    {
      id: 'email_8',
      channel: 'email',
      action: 'send',
      requiresContent: true,
      schedule: { delay: CAMPAIGN_CONSTANTS.MINIMUM_DELAY },
      transitions: [
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.NO_OPEN,
          to: 'email_9',
          after: CAMPAIGN_CONSTANTS.DAILY_EMAIL_DELAY,
        },
      ],
    },

    // Email 9: Last Chance
    {
      id: 'email_9',
      channel: 'email',
      action: 'send',
      requiresContent: true,
      schedule: { delay: CAMPAIGN_CONSTANTS.MINIMUM_DELAY },
      transitions: [
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.NO_OPEN,
          to: 'email_10',
          after: CAMPAIGN_CONSTANTS.DAILY_EMAIL_DELAY,
        },
      ],
    },

    // Email 10: Final Email/Breakup
    {
      id: 'email_10',
      channel: 'email',
      action: 'send',
      requiresContent: true,
      schedule: { delay: CAMPAIGN_CONSTANTS.MINIMUM_DELAY },
      transitions: [
        {
          on: CAMPAIGN_CONSTANTS.EVENTS.NO_OPEN,
          to: CAMPAIGN_CONSTANTS.NODES.STOP,
          after: CAMPAIGN_CONSTANTS.DAILY_EMAIL_DELAY,
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
 */
export const EMAIL_CONTENT_NODE_IDS = STATIC_CAMPAIGN_TEMPLATE.nodes
  .filter((node) => node.requiresContent)
  .map((node) => node.id);

/**
 * Email node descriptions for AI content generation.
 */
export const EMAIL_NODE_DESCRIPTIONS = {
  email_1: 'Initial introduction email to establish connection and generate interest',
  email_2: 'Follow-up email building on the introduction with additional context',
  email_3: 'Value proposition email highlighting key benefits and unique selling points',
  email_4: 'Social proof email with case studies, testimonials, or client success stories',
  email_5: 'Problem-solution email identifying pain points and presenting solutions',
  email_6: 'ROI-focused email with quantified benefits and business impact',
  email_7: 'Urgency email creating time-sensitive motivation to act',
  email_8: 'Direct ask email with clear call-to-action and next steps',
  email_9: 'Last chance email with final value proposition and urgency',
  email_10: 'Professional breakup email maintaining relationship for future opportunities',
} as const;

/**
 * Validates the simplified campaign template.
 */
export function validateCampaignTemplate(): {
  isValid: boolean;
  emailCount: number;
  errors: string[];
} {
  const errors: string[] = [];

  // Count email nodes
  const emailNodes = STATIC_CAMPAIGN_TEMPLATE.nodes.filter((node) => node.action === 'send');
  const emailCount = emailNodes.length;

  if (emailCount !== 10) {
    errors.push(`Expected 10 emails, found ${emailCount}`);
  }

  // Validate that all email nodes have descriptions
  for (const emailNode of emailNodes) {
    if (!(emailNode.id in EMAIL_NODE_DESCRIPTIONS)) {
      errors.push(`Missing description for email node: ${emailNode.id}`);
    }
  }

  // Validate no_open transitions
  for (const emailNode of emailNodes) {
    if (emailNode.id === 'email_10') continue; // Last email can go to stop

    const noOpenTransition = emailNode.transitions?.find(
      (t) => t.on === CAMPAIGN_CONSTANTS.EVENTS.NO_OPEN
    );
    
    if (!noOpenTransition) {
      errors.push(`${emailNode.id} missing no_open transition`);
    } else if ('after' in noOpenTransition && noOpenTransition.after !== CAMPAIGN_CONSTANTS.DAILY_EMAIL_DELAY) {
      errors.push(
        `${emailNode.id} has incorrect delay: ${noOpenTransition.after} (expected ${CAMPAIGN_CONSTANTS.DAILY_EMAIL_DELAY})`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    emailCount,
    errors,
  };
}

/**
 * Analyzes the email sequence to ensure proper flow.
 */
export function analyzeEmailSequence(): {
  sequence: string[];
  isComplete: boolean;
  totalDays: number;
  issues: string[];
} {
  const sequence: string[] = [];
  const issues: string[] = [];
  let currentNode = 'email_1';
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
      sequence.push(currentNode);
    }

    const noOpenTransition = node.transitions?.find(
      (t) => t.on === CAMPAIGN_CONSTANTS.EVENTS.NO_OPEN
    );
    
    if (noOpenTransition) {
      currentNode = noOpenTransition.to;
    } else {
      break;
    }
  }

  return {
    sequence,
    isComplete: currentNode === CAMPAIGN_CONSTANTS.NODES.STOP,
    totalDays: sequence.length,
    issues,
  };
}
