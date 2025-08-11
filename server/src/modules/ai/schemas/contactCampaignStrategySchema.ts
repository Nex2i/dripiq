import { z } from 'zod';

/** ========= Primitives ========= */
const IsoDuration = z
  .string()
  .regex(
    /^P(?!$)(\d+Y)?(\d+M)?(\d+D)?(T(\d+H)?(\d+M)?(\d+S)?)?$/,
    'ISO-8601 duration required, e.g. PT24H'
  );

const TimeHHMM = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'HH:MM 24h');

const Channel = z.enum(['email', 'sms']); // sms reserved for later
const Action = z.enum(['send', 'wait', 'stop']);

const EventType = z.enum([
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
]);

/** ========= Transitions ========= */
const Transition = z
  .object({
    on: EventType,
    to: z.string().min(1), // node id or "stop"
    // exactly one of within|after
    within: IsoDuration.optional(),
    after: IsoDuration.optional(),
  })
  .refine((t) => (t.within ? !t.after : !!t.after), {
    message: 'Provide either `within` or `after`, not both; one is required.',
    path: ['within'],
  });

/** ========= Nodes ========= */
const BaseNode = z.object({
  id: z.string().min(1),
  channel: Channel,
  action: Action,
  transitions: z.array(Transition).default([]),
});

const SendSchedule = z.object({
  delay: IsoDuration.optional(), // e.g., "PT0S", "PT72H"
  at: z.string().datetime().optional(), // absolute override
});

const SendNode = BaseNode.extend({
  action: z.literal('send'),
  // email: subject+body; sms: body only
  subject: z.string().optional(),
  body: z.string().optional(),
  senderIdentityId: z.string().optional(),
  schedule: SendSchedule.default({ delay: 'PT0S' }),
});

const WaitNode = BaseNode.extend({
  action: z.literal('wait'),
  // waits rely on transitions' within/after; no schedule
});

const StopNode = BaseNode.extend({
  action: z.literal('stop'),
  transitions: z.array(Transition).max(0).optional(),
});

const Node = z.discriminatedUnion('action', [SendNode, WaitNode, StopNode]);

/** ========= Plan ========= */
export const campaignPlanOutputSchema = z.object({
  version: z.string().default('1.0'),
  timezone: z.string().min(1), // IANA, e.g. "America/Los_Angeles"
  quietHours: z.object({ start: TimeHHMM, end: TimeHHMM }).optional(),

  // Defaults that AI can omit; timers can be {} without tripping overloads
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

  // Fallback sender if a send node lacks senderIdentityId
  senderIdentityId: z.string().optional(),

  startNodeId: z.string().min(1),
  nodes: z.array(Node).min(1),
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
