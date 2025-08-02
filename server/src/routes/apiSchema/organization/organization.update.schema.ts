import { Type } from '@sinclair/typebox';
import { OrganizationResponseSchema } from './organization.response.schema';

// Parameters for updating organization
export const UpdateOrganizationParamsSchema = Type.Object({
  id: Type.String({ description: 'Organization ID' }),
});

// Request schema for updating organization (all fields optional)
export const UpdateOrganizationRequestSchema = Type.Object({
  name: Type.Optional(Type.String({ description: 'Organization name' })),
  organizationName: Type.Optional(Type.String({ description: 'Organization name' })),
  organizationWebsite: Type.Optional(Type.String({ description: 'Organization website URL' })),
  summary: Type.Optional(Type.String({ description: 'Organization summary' })),
  differentiators: Type.Optional(
    Type.Array(Type.String(), { description: 'Organization differentiators' })
  ),
  targetMarket: Type.Optional(Type.String({ description: 'Organization target market' })),
  tone: Type.Optional(Type.String({ description: 'Organization tone of voice' })),
  logo: Type.Optional(
    Type.Union([Type.String(), Type.Null()], { description: 'Organization logo URL' })
  ),
  brandColors: Type.Optional(
    Type.Array(Type.String(), { description: 'Organization brand colors' })
  ),
});

// Response schema for updating organization
export const UpdateOrganizationResponseSchema = OrganizationResponseSchema;

// Complete schema for update organization route
export const OrganizationUpdateSchema = {
  params: UpdateOrganizationParamsSchema,
  body: UpdateOrganizationRequestSchema,
  response: {
    200: UpdateOrganizationResponseSchema,
  },
} as const;
