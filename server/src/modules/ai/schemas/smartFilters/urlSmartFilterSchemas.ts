import { z } from 'zod';

export const smartUrlFilterMapSchema = z.object({
  urls: z.array(z.string()).describe('The filtered list of URLs'),
});

export type SmartUrlFilterMapSchemaOutput = z.infer<typeof smartUrlFilterMapSchema>;
