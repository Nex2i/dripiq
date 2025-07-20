import z from 'zod';
import { getLeadById } from '../lead.service';
import { TenantService } from '../tenant.service';
import { vendorFitAgent } from './langchain';
import vendorFitInputSchema from './schemas/vendorFitInputSchema';
import vendorFitOutputSchema from './schemas/vendorFitOutputSchema';

export const LeadVendorFitService = {
  generateVendorFitReport: async (
    tenantId: string,
    leadId: string
  ): Promise<z.infer<typeof vendorFitOutputSchema>> => {
    const opportunity = await LeadVendorFitService.getOpportunity(tenantId, leadId);
    const partner = await LeadVendorFitService.getPartner(tenantId);

    const opportunityDescription = `
Company: ${opportunity.domain}
Summary: ${opportunity.summary}
Products: ${opportunity.products.join(', ')}
Services: ${opportunity.services.join(', ')}
Target Market: ${opportunity.targetMarket}
Differentiators: ${opportunity.differentiators.join(', ')}
Tone: ${opportunity.tone}
    `.trim();

    const vendorFitReport = await vendorFitAgent.analyzeVendorFit(partner, opportunityDescription);

    // TODO SAVE TO LEAD

    return vendorFitReport.finalResponseParsed ?? ({} as z.infer<typeof vendorFitOutputSchema>);
  },

  getOpportunity: async (
    tenantId: string,
    leadId: string
  ): Promise<z.infer<typeof vendorFitInputSchema>> => {
    const lead = await getLeadById(tenantId, leadId);

    return {
      summary: lead.summary ?? '',
      products: lead.products as string[],
      services: lead.services as string[],
      differentiators: lead.differentiators as string[],
      targetMarket: lead.targetMarket ?? '',
      tone: lead.tone ?? '',
      domain: lead.url ?? '',
    };
  },

  getPartner: async (tenantId: string): Promise<z.infer<typeof vendorFitInputSchema>> => {
    const tenant = await TenantService.getTenantById(tenantId);

    return {
      summary: tenant.summary ?? '',
      products: [], // TODO: Get products from products table
      services: [], // Services removed from schema
      differentiators: tenant.differentiators as string[],
      targetMarket: tenant.targetMarket ?? '',
      tone: tenant.tone ?? '',
      domain: tenant.website ?? '',
    };
  },
};
