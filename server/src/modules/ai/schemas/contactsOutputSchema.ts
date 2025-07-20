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

const contactsOutputSchema = z.object({
  contacts: z.array(contactSchema).describe('An array of contact information objects'),
});

export default contactsOutputSchema;
