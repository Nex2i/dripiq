import { Type } from '@sinclair/typebox';

// Organization response schema that matches the current API response structure
export const OrganizationResponseSchema = Type.Object({
  id: Type.String({ description: 'Organization ID' }),
  tenantName: Type.String({ description: 'Tenant name' }),
  organizationName: Type.String({ description: 'Organization name' }),
  organizationWebsite: Type.String({ description: 'Organization website URL' }),
  summary: Type.String({ description: 'Organization summary' }),
  products: Type.Array(Type.String(), { description: 'Organization products' }),
  services: Type.Array(Type.String(), { description: 'Organization services' }),
  differentiators: Type.Array(Type.String(), { description: 'Organization differentiators' }),
  targetMarket: Type.String({ description: 'Organization target market' }),
  tone: Type.String({ description: 'Organization tone of voice' }),
  logo: Type.Union([Type.String(), Type.Null()], { description: 'Organization logo URL' }),
  brandColors: Type.Array(Type.String(), { description: 'Organization brand colors' }),
});