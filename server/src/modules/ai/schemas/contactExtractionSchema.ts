import { z } from 'zod';

const extractedContactSchema = z.object({
  // Basic Information
  name: z
    .string()
    .describe(
      'Name of the person or office/department. For offices, use format like "Sales Office", "Support Team", "Headquarters"'
    ),

  // Contact Methods
  email: z.string().nullable().describe('Email address if available, null if not found'),
  phone: z.string().nullable().describe('Phone number if available, null if not found'),

  // Professional Information
  title: z
    .string()
    .nullable()
    .describe(
      'Job title for individuals (e.g., "CEO", "Head of Support"), or department type for offices (e.g., "Sales Department"), null if unknown'
    ),
  company: z
    .string()
    .nullable()
    .describe('Company name if different from main company, null if same or unknown'),

  // Contact Type and Context
  contactType: z
    .enum(['individual', 'office', 'department'])
    .describe('Type of contact: individual person, office/location, or department/team'),
  context: z
    .string()
    .nullable()
    .describe(
      'Additional context like department, location, or source page (e.g., "About Us page", "Boston Office", "Customer Support")'
    ),

  // Additional Information
  address: z.string().nullable().describe('Physical address if available, null if not found'),
  linkedinUrl: z
    .string()
    .nullable()
    .describe('LinkedIn profile URL if available, null if not found'),
  websiteUrl: z
    .string()
    .nullable()
    .describe('Personal or department website URL if available, null if not found'),

  // Source Information
  sourceUrl: z
    .string()
    .nullable()
    .describe('URL where this contact information was found, null if not tracked'),
  confidence: z
    .enum(['high', 'medium', 'low'])
    .describe('Confidence level in the accuracy of this contact information'),
});

const contactExtractionOutputSchema = z.object({
  contacts: z
    .array(extractedContactSchema)
    .describe(
      'Array of all extracted contact information, including both individuals and offices/departments'
    ),
  summary: z
    .string()
    .describe('Brief summary of contact extraction results and any notable findings'),
});

export default contactExtractionOutputSchema;
export type ExtractedContact = z.infer<typeof extractedContactSchema>;
export type ContactExtractionOutput = z.infer<typeof contactExtractionOutputSchema>;
