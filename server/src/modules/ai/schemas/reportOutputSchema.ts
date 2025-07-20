import { z } from 'zod';

const contactSchema = z.object({
  type: z
    .enum(['email', 'phone', 'address', 'form', 'other'])
    .describe('Type of contact information.'),
  value: z
    .string()
    .describe(
      'The actual contact detail, e.g., email address, phone number, address, form URL, etc.'
    ),
  context: z
    .string()
    .describe(
      'Context or department for this contact info, e.g., "Support", "Sales", "Headquarters". Use an empty string if not specified.'
    ),
  person: z
    .string()
    .describe(
      'Name of the person associated with this contact, if available. Use an empty string if not specified.'
    ),
  role: z
    .string()
    .describe(
      'Role/title of the person if available, e.g., "CEO", "Head of Support". Use an empty string if not specified.'
    ),
});

const reportOutputSchema = z.object({
  summary: z
    .string()
    .describe(
      'A summary of the company. Keep the summary around 2500 words. Should be returned in markdown'
    ),
  products: z.array(z.string()).describe('A list of products the company offers'),
  services: z.array(z.string()).describe('A list of services the company offers'),
  differentiators: z.array(z.string()).describe('A list of differentiators the company has'),
  targetMarket: z.string().describe('The target market the company is trying to serve'),
  tone: z.string().describe('The tone of the company'),
  contacts: z
    .array(contactSchema)
    .describe(
      'An array of contact information objects for the company, including emails, phone numbers, addresses, forms, and any other provided contact methods. All fields must be present; use empty strings for unknown context, person, or role.'
    ),
});

export default reportOutputSchema;
