import { z } from 'zod';

/**
 * {
  "headline": "Concise, engaging headline summarizing the vendor fit",
  "subHeadline": "Supporting sentence expanding on the headline",
  "summary": "Detailed markdown-formatted summary clearly stating why the Partner is an excellent fit for the Opportunity.",
  "partnerProducts": ["Key Partner products specifically beneficial to the Opportunity"],
  "partnerServices": ["Relevant Partner services tailored to the Opportunity’s needs"],
  "keyDifferentiators": ["Distinctive strengths and differentiators setting the Partner apart"],
  "marketAlignment": "Description of how Partner’s target market aligns with Opportunity’s customer or audience base",
  "brandToneMatch": "Explanation of how the Partner’s brand tone aligns or complements the Opportunity’s brand and values",
  "cta": "Clear call-to-action prompting the Opportunity to engage or learn more"
}
 */

const vendorFitOutputSchema = z.object({
  headline: z.string().describe('A concise, engaging headline summarizing the vendor fit'),
  subHeadline: z.string().describe('A supporting sentence expanding on the headline'),
  summary: z
    .string()
    .describe(
      'A detailed markdown-formatted summary clearly stating why the Partner is an excellent fit for the Opportunity.'
    ),
  partnerProducts: z
    .array(z.string())
    .describe('Key Partner products specifically beneficial to the Opportunity'),
  partnerServices: z
    .array(z.string())
    .describe('Relevant Partner services tailored to the Opportunity’s needs'),
  keyDifferentiators: z
    .array(z.string())
    .describe('Distinctive strengths and differentiators setting the Partner apart'),
  marketAlignment: z
    .string()
    .describe(
      'Description of how Partner’s target market aligns with Opportunity’s customer or audience base'
    ),
  brandToneMatch: z
    .string()
    .describe(
      'Explanation of how the Partner’s brand tone aligns or complements the Opportunity’s brand and values'
    ),
  cta: z
    .string()
    .describe('Clear call-to-action prompting the Opportunity to engage or learn more'),
});

export default vendorFitOutputSchema;
