import { z } from 'zod';

// Input Schemas with Business Context

const leadDetailsSchema = z
  .object({
    id: z.string().describe('Unique identifier for the lead company'),
    name: z.string().describe('Company name for personalization and targeting'),
    url: z.string().describe('Company website for research and validation'),
    summary: z
      .string()
      .optional()
      .describe('AI-generated company overview for context understanding'),
    products: z
      .string()
      .optional()
      .describe("Company's product offerings to identify integration opportunities"),
    services: z
      .string()
      .optional()
      .describe("Company's service offerings to find complementary solutions"),
    differentiators: z
      .string()
      .optional()
      .describe('Unique value propositions to understand competitive positioning'),
    targetMarket: z.string().optional().describe("Company's target audience to align messaging"),
    tone: z.string().optional().describe("Company's communication style for message matching"),
    status: z.string().describe('Current lead stage for appropriate outreach timing'),
  })
  .describe('Represents the target company/prospect being pursued');

const contactDetailsSchema = z
  .object({
    id: z.string().describe('Unique contact identifier'),
    name: z.string().describe("Contact's full name for personalization"),
    title: z
      .string()
      .optional()
      .describe('Job title to understand decision-making authority and pain points'),
    company: z.string().optional().describe('Company affiliation for context'),
    sourceUrl: z.string().optional().describe('Where contact info was found for credibility'),
  })
  .describe('Represents the specific person being contacted within the target company');

const partnerDetailsSchema = z
  .object({
    id: z.string().describe('Partner organization identifier'),
    name: z.string().describe('Partner company name for credibility'),
    website: z.string().optional().describe('Partner website for reference and trust building'),
    organizationName: z
      .string()
      .optional()
      .describe('Formal organization name if different from brand'),
    summary: z.string().optional().describe('Partner value proposition and background'),
    differentiators: z.array(z.string()).optional().describe('Unique selling points to emphasize'),
    targetMarket: z.string().optional().describe("Partner's ideal customer profile for alignment"),
    tone: z.string().optional().describe("Partner's communication style for consistent messaging"),
  })
  .describe("Represents the selling organization's information for positioning");

const salesmanSchema = z
  .object({
    id: z.string().optional().describe('Salesperson identifier'),
    name: z.string().optional().describe('Salesperson name for signature and personalization'),
    email: z.string().optional().describe('Salesperson contact for responses and scheduling'),
  })
  .describe('Represents the sales person conducting outreach for personalization');

const partnerProductSchema = z
  .object({
    id: z.string().describe('Product identifier'),
    title: z.string().describe('Product name for clear communication'),
    description: z.string().optional().describe('Product overview for value proposition'),
    salesVoice: z.string().optional().describe('Tailored messaging for this product'),
    siteUrl: z.string().optional().describe('Product-specific landing page for referrals'),
    siteContent: z
      .string()
      .optional()
      .describe('Combined content from product website for context'),
  })
  .describe('Represents products/services being sold to match with prospect needs');

const contactStrategyInputSchema = z.object({
  leadDetails: leadDetailsSchema.describe('Represents the target company/prospect being pursued'),
  contactDetails: contactDetailsSchema.describe(
    'Represents the specific person being contacted within the target company'
  ),
  partnerDetails: partnerDetailsSchema.describe(
    "Represents the selling organization's information for positioning"
  ),
  partnerProducts: z
    .array(partnerProductSchema)
    .describe('Represents products/services being sold to match with prospect needs'),
  salesman: salesmanSchema.describe(
    'Represents the sales person conducting outreach for personalization'
  ),
});

// Output Schemas (existing)

const outreachTouchpointSchema = z
  .object({
    type: z.enum(['email', 'call']).describe('Communication channel for this touchpoint'),
    timing: z.string().describe('When to send this touchpoint (e.g., "Day 1", "Day 3")'),
    subject: z.string().optional().describe('Email subject line or call purpose'),
    content: z.string().describe('Message content tailored specifically to the contact'),
    callToAction: z.string().describe('Clear next step requested from the contact'),
  })
  .describe('Represents the communication channel for this touchpoint');

const outreachStrategyOutputSchema = z
  .object({
    outreachCampaign: z.array(outreachTouchpointSchema).describe('Ordered outreach campaign steps'),
    cadence: z.object({
      interval: z.string().describe('Recommended interval between touchpoints'),
      totalDuration: z.string().describe('Total campaign duration'),
    }),
    summary: z.string().describe('Brief summary of outreach campaign goals'),
  })
  .describe('Represents the ordered outreach campaign steps');

// Type exports for input schemas
export type LeadDetails = z.infer<typeof leadDetailsSchema>;
export type ContactDetails = z.infer<typeof contactDetailsSchema>;
export type PartnerDetails = z.infer<typeof partnerDetailsSchema>;
export type Salesman = z.infer<typeof salesmanSchema>;
export type PartnerProduct = z.infer<typeof partnerProductSchema>;
export type ContactStrategyInput = z.infer<typeof contactStrategyInputSchema>;

// Type exports for output schemas (existing)
export type OutreachTouchpoint = z.infer<typeof outreachTouchpointSchema>;
export type OutreachStrategyOutput = z.infer<typeof outreachStrategyOutputSchema>;

// Schema exports
export {
  leadDetailsSchema,
  contactDetailsSchema,
  partnerDetailsSchema,
  salesmanSchema,
  partnerProductSchema,
  contactStrategyInputSchema,
  outreachTouchpointSchema,
  outreachStrategyOutputSchema,
};
