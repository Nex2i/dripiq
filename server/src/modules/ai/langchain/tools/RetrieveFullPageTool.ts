import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { siteEmbeddingRepository } from '@/repositories';

export const RetrieveFullPageTool = new DynamicStructuredTool({
  name: 'RetrieveFullPageTool',
  description:
    'Downloads the HTML from any page URL, cleans and converts it to readable Markdown. Use this format: {"url": "https://example.com/about"}. Input the exact URL. The output is the full text of the page, formatted and ready for processing or embedding. When to use: You need the actual page content as Markdown, either to review, or debug.',
  schema: z.object({
    url: z.string().describe('The URL of the page to retrieve'),
  }),
  func: async (input: { url: string }) => {
    try {
      const { url } = input;

      if (!url) {
        return 'Error: url field is required';
      }

      const cleanUrl = url.cleanWebsiteUrl();

      const embeddings = await siteEmbeddingRepository.findByUrl(cleanUrl);

      const fullMarkdown = embeddings.map((embedding) => embedding.content).join('\n');

      if (!fullMarkdown) {
        return `No content found for URL: ${cleanUrl}`;
      }

      return JSON.stringify({
        domain: cleanUrl,
        content: fullMarkdown,
      });
    } catch (error) {
      return `Error retrieving page content: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`;
    }
  },
});
