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
});

export default reportOutputSchema;
