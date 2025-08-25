# Campaign Template Schema

```typescript
import { z } from 'zod';

/** ========= Primitives ========= */
const IsoDuration = z
  .string()
  .regex(
    /^P(?!$)(\d+Y)?(\d+M)?(\d+D)?(T(\d+H)?(\d+M)?(\d+S)?)?$/,
    'ISO-8601 duration required, e.g. PT24H'
  )
  .describe(
    'ISO-8601 duration used for timers and delays. Examples: PT0S (now), PT24H (24 hours), P3D (3 days).'
  );

const TimeHHMM = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'HH:MM 24h')
  .describe('Time of day in 24-hour HH:MM format (local to plan.timezone).');

const Channel = z
  .enum(['email'])
  .describe('Delivery channel for a node. email is the only supported channel for now.');

const Action = z
  .enum(['send', 'wait', 'stop'])
  .describe('Node action type: send | wait | stop.');

const EventType = z
  .enum([
    'delivered',
    'opened',
    'clicked',
    'bounced',
    'unsubscribed',
    // synthetic events
    'no_open',
    'no_click',
  ])
  .describe('Events that can trigger transitions between campaign nodes.');

/** ========= Transitions ========= */
const TransitionWithin = z
  .object({
    on: EventType.describe('Event that triggers this transition'),
    to: z.string().min(1).describe('Target node ID to transition to'),
    within: IsoDuration.describe('Maximum time window for this event to occur'),
  })
  .strict()
  .describe('Transition that occurs if event happens within specified time window');

const TransitionAfter = z
  .object({
    on: EventType.describe('Event that triggers this transition'),
    to: z.string().min(1).describe('Target node ID to transition to'),
    after: IsoDuration.default('PT24H').describe('Time to wait after event before transitioning'),
  })
  .strict()
  .describe('Transition that occurs after specified time following event');

export const Transition = z.union([TransitionWithin, TransitionAfter]);

/** ========= Nodes ========= */
const BaseNode = z.object({
  id: z.string().min(1).describe('Unique node identifier within the campaign template (e.g., "email_1", "wait_click_1")'),
  channel: Channel.describe('Communication channel used for this node'),
  action: Action.describe('Type of operation this node performs'),
  touchpoint: z.number().int().min(1).max(10).optional().describe('Which of the 10 touchpoints this node represents (1-10)'),
  transitions: z
    .array(Transition)
    .default([])
    .describe('Ordered list of possible state transitions. First matching condition wins.'),
});

const SendSchedule = z
  .object({
    delay: IsoDuration.default('PT0S').describe('Relative delay from node activation until send'),
    at: z
      .string()
      .datetime()
      .optional()
      .describe('Absolute RFC3339 date-time to send exactly (overrides delay)'),
  })
  .partial()
  .default({ delay: 'PT0S' })
  .describe('Scheduling configuration for when to send this email');

const SendNode = BaseNode.extend({
  action: z.literal('send'),
  subject: z.string().describe('Email subject line template with AI placeholder: ${AI_SUBJECT_N}'),
  body: z.string().describe('Email body content template with AI placeholder: ${AI_BODY_N}'),
  schedule: SendSchedule.describe('When this email should be sent'),
}).describe('Node that sends an email to the contact');

const WaitNode = BaseNode.extend({
  action: z.literal('wait'),
}).describe('Node that waits for contact engagement events (opens, clicks) before proceeding');

const StopNode = BaseNode.extend({
  action: z.literal('stop'),
  transitions: z.array(Transition).max(0).default([]).describe('Stop nodes have no outgoing transitions'),
}).describe('Terminal node that ends the campaign');

/** ========= Discriminated Union ========= */
const Node = z.discriminatedUnion('action', [SendNode, WaitNode, StopNode]);

export type CampaignTemplateNode = z.infer<typeof Node>;

/** ========= Campaign Template Schema ========= */
export const campaignTemplateSchema = z.object({
  version: z.string().default('1.0').describe('Template schema version'),
  
  name: z.string().min(1).describe('Human-readable name for this campaign template'),
  
  leadCategory: z.enum(['lost', 'cold']).describe('Lead category this template is designed for'),
  
  timezone: z.string().default('${LEAD_TIMEZONE}').describe('IANA timezone placeholder that will be replaced with lead\'s detected timezone'),
  
  totalTouchpoints: z.number().int().min(1).max(10).default(10).describe('Total number of touchpoints (main emails) in this campaign'),
  
  totalEmails: z.number().int().min(10).max(20).describe('Total number of email nodes (including follow-ups for opens/clicks)'),
  
  quietHours: z
    .object({
      start: TimeHHMM.describe('Daily quiet hours start time'),
      end: TimeHHMM.describe('Daily quiet hours end time'),
    })
    .optional()
    .describe('Time window when emails should not be sent'),
    
  defaults: z
    .object({
      timers: z
        .object({
          no_open_after: IsoDuration.default('PT72H').describe('How long to wait for opens before triggering no_open'),
          no_click_after: IsoDuration.default('PT24H').describe('How long to wait for clicks after open before triggering no_click'),
        })
        .partial()
        .default({ no_open_after: 'PT72H', no_click_after: 'PT24H' }),
    })
    .default({ timers: { no_open_after: 'PT72H', no_click_after: 'PT24H' } })
    .describe('Default timing configurations for the campaign'),
    
  startNodeId: z.string().min(1).describe('ID of the first node to execute in the campaign'),
  
  nodes: z
    .array(Node)
    .min(11)
    .max(41)
    .describe('All nodes in the campaign graph. Must include 10 send nodes (touchpoints), up to 10 wait nodes, and 1 stop node'),
    
}).describe('Complete campaign template with 10 touchpoints and up to 20 total emails');

export type CampaignTemplate = z.infer<typeof campaignTemplateSchema>;

/** ========= Template Structure Example ========= */
/*
Example Campaign Template Structure (Lost Lead - Aggressive):

10 Touchpoints = 10 main emails
Up to 20 total emails because of engagement branches:

Touchpoint 1: email_1 → wait_click_1 → (click: stop, no_click: email_2)
Touchpoint 2: email_2 → wait_click_2 → (click: stop, no_click: email_3)
...
Touchpoint 10: email_10 → stop (final email, no further sends)

Each touchpoint can branch into:
- Main email (send node)
- Wait for click (wait node) 
- Potential engagement-based follow-up

Flow Logic:
1. Send email_N
2. If opened → wait for click
3. If clicked → stop campaign (success)
4. If no click after timer → proceed to next touchpoint
5. If no open after timer → proceed to next touchpoint

This creates up to 20 total emails:
- 10 main touchpoint emails
- Up to 10 additional engagement-based emails
*/
```