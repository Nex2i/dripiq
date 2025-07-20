import { DynamicTool } from '@langchain/core/tools';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, siteEmbeddings } from '@/db';

export const RetrieveFullPageTool = new DynamicTool({
  name: 'RetrieveFullPageTool',
  description: 'Downloads the HTML from any page URL, cleans and converts it to readable Markdown. Use this format: {"url": "https://example.com/about"}. Input the exact URL. The output is the full text of the page, formatted and ready for processing or embedding. When to use: You need the actual page content as Markdown, either to review, or debug.',
  func: async (input: string) => {
    try {
      let parsedInput;
      try {
        parsedInput = JSON.parse(input);
      } catch {
        // If input is not JSON, treat as direct URL
        parsedInput = { url: input };
      }

      const { url } = parsedInput;
      
      if (!url) {
        return 'Error: url field is required';
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
  }
});