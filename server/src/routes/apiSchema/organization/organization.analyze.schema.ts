import { Type } from '@sinclair/typebox';

// Parameters for organization analysis/resync
export const AnalyzeOrganizationParamsSchema = Type.Object({
  id: Type.String({ description: 'Organization ID' }),
});

// Response schema for organization resync/analysis
export const AnalyzeOrganizationResponseSchema = Type.Object({
  message: Type.String({ description: 'Success message' }),
  id: Type.String({ description: 'Organization ID' }),
  siteAnalyzerResult: Type.Any({ description: 'Site analyzer result data' }),
});

// Complete schema for analyze/resync organization route
export const OrganizationAnalyzeSchema = {
  params: AnalyzeOrganizationParamsSchema,
  response: {
    200: AnalyzeOrganizationResponseSchema,
  },
} as const;