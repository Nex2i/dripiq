import { DynamicTool } from '@langchain/core/tools';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, siteEmbeddings } from '@/db';

const schema = z.object({
  url: z.string().describe('The full URL to fetch and convert (e.g., https://example.com/about)'),
});

export class RetrieveFullPageTool extends DynamicTool {
  constructor() {
    super({
      name: 'RetrieveFullPageTool',
      description: 'Downloads the HTML from any page URL, cleans and converts it to readable Markdown. Input the exact URL (e.g., https://acme.com/about). The output is the full text of the page, formatted and ready for processing or embedding. When to use: You need the actual page content as Markdown, either to review, or debug.',
      func: async (input: string) => {
        try {
          let url: string;
          
          try {
            const parsedInput = JSON.parse(input);
            url = parsedInput.url;
          } catch {
            // If input is not JSON, treat as direct URL
            url = input;
          }

          const cleanUrl = url.cleanWebsiteUrl();

          const embeddings = await db
            .select({ id: siteEmbeddings.id, content: siteEmbeddings.content })
            .from(siteEmbeddings)
            .where(eq(siteEmbeddings.url, cleanUrl));

          const fullMarkdown = embeddings.map((embedding) => embedding.content).join('\n');

          if (!fullMarkdown) {
            return `No content found for URL: ${cleanUrl}`;
          }

          return JSON.stringify({
            domain: cleanUrl,
            content: fullMarkdown,
          });
        } catch (error) {
          return `Error retrieving page content: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
    });
  }
}