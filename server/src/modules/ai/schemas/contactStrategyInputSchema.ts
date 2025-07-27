import { z } from 'zod';

const contactStrategyInputSchema = z.object({
  leadId: z.string().describe('The ID of the lead/opportunity to analyze'),
  contactId: z.number().describe('The index of the specific contact to focus the analysis on'),
  tenantId: z.string().describe('The ID of the tenant/partner'),
});

export default contactStrategyInputSchema;
