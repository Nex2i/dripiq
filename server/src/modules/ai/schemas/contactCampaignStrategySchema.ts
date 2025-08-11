import { z } from 'zod';

/** ========= Primitives ========= */
const IsoDuration = z
  .string()
  .regex(
    /^P(?!$)(\d+Y)?(\d+M)?(\d+D)?(T(\d+H)?(\d+M)?(\d+S)?)?$/,
    'ISO-8601 duration required, e.g. PT24H'
  )
  .describe(
    'ISO‑8601 duration used for timers and delays. Examples: PT0S (now), PT24H (24 hours), P3D (3 days).'
  );

const TimeHHMM = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'HH:MM 24h')
  .describe('Time of day in 24‑hour HH:MM format (local to plan.timezone).');

const Channel = z
  .enum(['email', 'sms'])
  .describe('Delivery channel for a node. SMS is reserved for later.');

const Action = z
  .enum(['send', 'wait', 'stop'])
  .describe(
    'Node action type: send (dispatch a message), wait (pause and watch for events), stop (terminate campaign).'
  );

const EventType = z
  .enum([
    'delivered',
    'opened',
    'clicked',
    'bounced',
    'blocked',
    'spamreport',
    'unsubscribed',
    // synthetic
    'no_open',
    'no_click',
  ])
  .describe(
    'Events that can trigger transitions. Includes provider events and synthetic timers (no_open/no_click).'
  );

/** ========= Transitions ========= */
const Transition = z
  .object({
    on: EventType.describe('Event that triggers this transition (e.g., opened, clicked, no_open).'),
    to: z.string().min(1).describe('Target node id or the literal "stop" to end the campaign.'),
    // exactly one of within|after
    within: IsoDuration.optional().describe(
      'Guarded window: if the event occurs within this duration from reaching the current node, take this transition.'
    ),
    after: IsoDuration.optional().describe(
      'Timeout: after this duration elapses without the event, fire the transition (used for synthetic events).'
    ),
  })
  .describe(
    'Defines how a campaign moves from one node to another in response to events or timers.'
  )
  .refine((t) => (t.within ? !t.after : !!t.after), {
    message: 'Provide either `within` or `after`, not both; one is required.',
    path: ['within'],
  });

/** ========= Nodes ========= */
const BaseNode = z
  .object({
    id: z.string().min(1).describe('Unique node identifier within the plan.'),
    channel: Channel.describe('Channel used for this node.'),
    action: Action.describe('Type of operation this node performs.'),
    transitions: z
      .array(Transition)
      .default([])
      .describe('Ordered list of possible moves from this node. First matching rule wins.'),
  })
  .describe('Common fields shared by all node types.');

const SendSchedule = z
  .object({
    delay: IsoDuration.optional().describe(
      'Relative delay from node activation until send. Example: "PT0S", "PT72H".'
    ),
    at: z
      .string()
      .datetime()
      .optional()
      .describe(
        'Absolute ISO date‑time (RFC 3339) to override delay and schedule the send exactly.'
      ),
  })
  .describe(
    'Scheduling options for send nodes. Use either delay (typical) or at (absolute override).'
  );

const SendNode = BaseNode.extend({
  action: z.literal('send').describe('Dispatch a message on the given channel.'),
  // email: subject+body; sms: body only
  subject: z
    .string()
    .optional()
    .describe('Email subject (ignored for SMS). May include template tokens.'),
  body: z.string().optional().describe('Message body. May include template tokens.'),
  senderIdentityId: z
    .string()
    .optional()
    .describe(
      'Optional sender identity override for this node. Falls back to plan.senderIdentityId.'
    ),
  schedule: SendSchedule.default({ delay: 'PT0S' }).describe(
    'When to send. Defaults to immediate (PT0S).'
  ),
}).describe('Node that sends a message (email now; SMS later).');

const WaitNode = BaseNode.extend({
  action: z.literal('wait').describe('Pause and watch for events/timers.'),
  // waits rely on transitions' within/after; no schedule
}).describe('Node that does not send. Progresses only via transitions with within/after timers.');

const StopNode = BaseNode.extend({
  action: z.literal('stop').describe('Terminate the campaign.'),
  transitions: z
    .array(Transition)
    .max(0)
    .optional()
    .describe('Stop nodes cannot have transitions.'),
}).describe('Terminal node that ends execution.');

const Node = z
  .discriminatedUnion('action', [SendNode, WaitNode, StopNode])
  .describe('Union of all node types. Discriminated by `action`: send | wait | stop.');

/** ========= Plan ========= */
export const campaignPlanOutputSchema = z
  .object({
    version: z.string().default('1.0').describe('Schema version for compatibility and migrations.'),
    timezone: z
      .string()
      .min(1)
      .describe('IANA timezone (e.g., "America/Los_Angeles") used for quiet hours and scheduling.'),
    quietHours: z
      .object({
        start: TimeHHMM.describe(
          'Local start of quiet hours (no sends will be scheduled within this window).'
        ),
        end: TimeHHMM.describe('Local end of quiet hours (sends resume at or after this time).'),
      })
      .optional()
      .describe('Optional per‑plan quiet hours window evaluated in the plan timezone.'),

    // Defaults that AI can omit; timers can be {} without tripping overloads
    defaults: z
      .object({
        timers: z
          .object({
            no_open_after: IsoDuration.default('PT72H').describe(
              'Default timeout to emit the synthetic no_open event after a send.'
            ),
            no_click_after: IsoDuration.default('PT24H').describe(
              'Default timeout to emit the synthetic no_click event after an open.'
            ),
          })
          .partial()
          .default({ no_open_after: 'PT72H', no_click_after: 'PT24H' })
          .describe('Plan‑wide timer defaults applied when transitions omit explicit durations.'),
      })
      .default({ timers: { no_open_after: 'PT72H', no_click_after: 'PT24H' } })
      .describe('Optional defaults applied across nodes if unspecified.'),

    // Fallback sender if a send node lacks senderIdentityId
    senderIdentityId: z
      .string()
      .optional()
      .describe('Default sender identity used by send nodes that do not specify an override.'),

    startNodeId: z.string().min(1).describe('The id of the node where execution begins.'),
    nodes: z.array(Node).min(1).describe('All nodes that make up the campaign graph.'),
  })
  .describe('Top‑level campaign plan defining timezone, defaults, graph nodes, and entry point.');

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
  "senderIdentityId": "sender_123",
  "startNodeId": "email_intro",
  "nodes": [
    {
      "id": "email_intro",
      "channel": "email",
      "action": "send",
      "subject": "{subject}",
      "body": "{personalized_body}",
      "senderIdentityId": "sender_123",
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
