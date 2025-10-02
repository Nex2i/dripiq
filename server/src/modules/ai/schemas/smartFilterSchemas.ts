import { z } from 'zod';

export const smartFilterSiteMapSchema = z.object({
  urls: z.array(z.string()).describe('The filtered list of URLs'),
});

export type SmartFilterSiteMapOutput = z.infer<typeof smartFilterSiteMapSchema>;
