import { Type } from '@sinclair/typebox';
import { OrganizationResponseSchema } from './organization.response.schema';

// Parameters for getting organization details
export const GetOrganizationParamsSchema = Type.Object({
  id: Type.String({ description: 'Organization ID' }),
});

// Response schema for getting organization details
export const GetOrganizationResponseSchema = OrganizationResponseSchema;

// Complete schema for get organization route
export const OrganizationGetSchema = {
  params: GetOrganizationParamsSchema,
  response: {
    200: GetOrganizationResponseSchema,
  },
} as const;