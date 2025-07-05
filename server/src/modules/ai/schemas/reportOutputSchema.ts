import { z } from 'zod';

const reportOutputSchema = z.object({
  summary: z
    .string()
    .describe(
      'A summary of the company. Keep the summary around 2500 words. Should be returned in markdown'
    ),
  products: z.array(z.string()).describe('A list of products the company offers'),
  services: z.array(z.string()).describe('A list of services the company offers'),
  differentiators: z.array(z.string()).describe('A list of differentiators the company has'),
  targetMarket: z.string().describe('The target market the company is trying to serve'),
  tone: z.string().describe('The tone of the company'),
  brandColors: z
    .array(z.string())
    .describe(
      'An array of hex color codes representing the brand color palette. Include primary, secondary, and accent colors if available. Format as hex codes (e.g., #FF5733, #33C4FF)'
    ),
});

export default reportOutputSchema;
