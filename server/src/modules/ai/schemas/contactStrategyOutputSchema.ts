import { z } from 'zod';

const outreachTouchpointSchema = z.object({
  type: z.enum(['email', 'call']).describe('Communication channel for this touchpoint'),
  timing: z.string().describe('When to send this touchpoint (e.g., "Day 1", "Day 3")'),
  subject: z.string().optional().describe('Email subject line or call purpose'),
  content: z.string().describe('Message content tailored specifically to the contact'),
  callToAction: z.string().describe('Clear next step requested from the contact'),
});

const outreachStrategyOutputSchema = z.object({
  outreachCampaign: z.array(outreachTouchpointSchema).describe('Ordered outreach campaign steps'),
  cadence: z.object({
    interval: z.string().describe('Recommended interval between touchpoints'),
    totalDuration: z.string().describe('Total campaign duration'),
  }),
  summary: z.string().describe('Brief summary of outreach campaign goals'),
});

export default outreachStrategyOutputSchema;
export type OutreachTouchpoint = z.infer<typeof outreachTouchpointSchema>;
export type OutreachStrategyOutput = z.infer<typeof outreachStrategyOutputSchema>;
