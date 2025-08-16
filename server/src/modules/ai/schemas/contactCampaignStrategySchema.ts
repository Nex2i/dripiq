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
const Action = z.enum(['send', 'wait', 'stop']).describe('Node action type: send | wait | stop.');

const EventType = z
  .enum([
    'delivered',
    'opened',
    'clicked',
    // synthetic
    'no_open',
    'no_click',
  ])
  .describe('Events that can trigger transitions.');

/** ========= Transitions ========= */
/** Transition as a union: within OR after (after defaults to 24h) */
const TransitionWithin = z
  .object({
    on: EventType,
    to: z.string().min(1),
    within: IsoDuration,
  })
  .strict(); // forbids "after"

const TransitionAfter = z
  .object({
    on: EventType,
    to: z.string().min(1),
    // default applied at parse time if missing
    after: IsoDuration.default('PT24H'),
  })
  .strict(); // forbids "within"

export const Transition = z.union([TransitionWithin, TransitionAfter]);
/** ========= Nodes ========= */
const BaseNode = z.object({
  id: z.string().min(1).describe('Unique node identifier within the plan.'),
  channel: Channel.describe('Channel used for this node.'),
  action: Action.describe('Type of operation this node performs.'),
  transitions: z
    .array(Transition)
    .default([])
    .describe('Ordered list of possible moves. First matching wins.'),
});

const SendSchedule = z
  .object({
    // If a schedule object is present without delay, default to PT0S.
    delay: IsoDuration.default('PT0S').describe('Relative delay from node activation until send.'),
    at: z
      .string()
      .datetime()
      .optional()
      .describe('Absolute RFC3339 date-time to send exactly (overrides delay).'),
  })
  .partial()
  // If the entire schedule is missing, default to { delay: "PT0S" }.
  .default({ delay: 'PT0S' });

const SendNode = BaseNode.extend({
  action: z.literal('send'),
  subject: z.string().optional().describe('Email subject (ignored for SMS).'),
  body: z.string().optional().describe('Message body.'),
  // Ensure schedule always resolves to a usable value:
  schedule: SendSchedule.catch({ delay: 'PT0S' }),
});

const WaitNode = BaseNode.extend({
  action: z.literal('wait'),
  // waits rely on transitions’ within/after; no schedule
});

const StopNode = BaseNode.extend({
  action: z.literal('stop'),
  // Allow either omitting transitions or explicitly providing [].
  transitions: z.array(Transition).max(0).default([]),
});

/** ========= Discriminated Union ========= */
const Node = z.discriminatedUnion('action', [SendNode, WaitNode, StopNode]);

// Export the Node type for use in other modules
export type CampaignPlanNode = z.infer<typeof Node>;

/** ========= Plan ========= */
export const campaignPlanOutputSchema = z.object({
  version: z.string().default('1.0').describe('Schema version.'),
  timezone: z.string().min(1).describe('IANA timezone, e.g. "America/Los_Angeles".'),
  quietHours: z
    .object({
      start: TimeHHMM.describe('Quiet hours start.'),
      end: TimeHHMM.describe('Quiet hours end.'),
    })
    .optional(),
  defaults: z
    .object({
      timers: z
        .object({
          no_open_after: IsoDuration.default('PT72H'),
          no_click_after: IsoDuration.default('PT24H'),
        })
        .partial()
        .default({ no_open_after: 'PT72H', no_click_after: 'PT24H' }),
    })
    .default({ timers: { no_open_after: 'PT72H', no_click_after: 'PT24H' } }),
  startNodeId: z.string().min(1).describe('Entry node id.'),
  nodes: z.array(Node).min(1).describe('All nodes in the campaign graph.'),
});

export type CampaignPlanOutput = z.infer<typeof campaignPlanOutputSchema>;

/*
Example CampaignPlan output:

{
  "version": "1.0",
  "timezone": "America/Los_Angeles",
  "quietHours": { "start": "21:00", "end": "07:30" },
  "defaults": {
    "timers": {
      "no_open_after": "PT72H",
      "no_click_after": "PT24H"
    }
  },
  "startNodeId": "email_intro",
  "nodes": [
    {
      "id": "email_intro",
      "channel": "email",
      "action": "send",
      "subject": "{subject}",
      "body": "{personalized_body}",
      "schedule": { "delay": "PT0S" },
      "transitions": [
        { "on": "opened", "to": "wait_click", "within": "PT72H" },
        { "on": "no_open", "to": "email_bump_1", "after": "PT72H" },
        { "on": "bounced", "to": "stop", "after": "PT0S" },
        { "on": "unsubscribed", "to": "stop", "after": "PT0S" }
      ]
    },
    {
      "id": "wait_click",
      "channel": "email",
      "action": "wait",
      "transitions": [
        { "on": "clicked", "to": "stop", "within": "PT24H" },
        { "on": "no_click", "to": "email_bump_1", "after": "PT24H" }
      ]
    },
    {
      "id": "email_bump_1",
      "channel": "email",
      "action": "send",
      "subject": "{bump_subject}",
      "body": "{bump_body}",
      "schedule": { "delay": "PT0S" },
      "transitions": [
        { "on": "opened", "to": "stop", "within": "PT72H" },
        { "on": "no_open", "to": "stop", "after": "PT72H" },
        { "on": "bounced", "to": "stop", "after": "PT0S" },
        { "on": "unsubscribed", "to": "stop", "after": "PT0S" }
      ]
    },
    {
      "id": "stop",
      "channel": "email",
      "action": "stop"
    }
  ]
}
*/
