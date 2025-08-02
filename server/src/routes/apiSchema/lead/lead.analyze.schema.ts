import { Type } from '@sinclair/typebox';

// Parameters for lead analysis routes
export const AnalyzeLeadParamsSchema = Type.Object({
  id: Type.String({ description: 'Lead ID' }),
});

// Parameters for contact strategy
export const ContactStrategyParamsSchema = Type.Object({
  leadId: Type.String({ description: 'Lead ID' }),
  contactId: Type.String({ description: 'Contact ID' }),
});

// Response schema for vendor fit report
export const VendorFitResponseSchema = Type.Object({
  message: Type.String({ description: 'Success message' }),
  vendorFitReport: Type.Any({ description: 'Vendor fit report data' }),
});

// Response schema for resync lead
export const ResyncLeadResponseSchema = Type.Object({
  message: Type.String(),
  leadId: Type.String(),
});

// Response schema for contact strategy
export const ContactStrategyResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String(),
  data: Type.Any({ description: 'Contact strategy data' }),
  metadata: Type.Object({
    totalIterations: Type.Number(),
    processingTime: Type.Number(),
  }),
});

// Complete schemas for analysis routes
export const LeadVendorFitSchema = {
  params: AnalyzeLeadParamsSchema,
  response: {
    200: VendorFitResponseSchema,
  },
} as const;

export const LeadResyncSchema = {
  params: AnalyzeLeadParamsSchema,
  response: {
    200: ResyncLeadResponseSchema,
  },
} as const;

export const LeadContactStrategySchema = {
  params: ContactStrategyParamsSchema,
  response: {
    200: ContactStrategyResponseSchema,
  },
} as const;
