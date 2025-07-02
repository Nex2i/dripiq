// Scrape site and return markdown
// Save full markdown to storage
// split markdown into chunks
// save chunks to storage
// embed chunks in vector database
// create summary of site
// save summary to storage
// save metadata to database
// return metadata

// TODAY'S GOAL:
// 1. Scrape site and return markdown
// 2. Save full markdown to storage
// 3. Split markdown into chunks
// 4. Save chunks to storage
// 5. Embed chunks in vector database
// 6. Create summary of site
// 7. Save summary to storage
// 8. Save metadata to database
// 9. Return metadata
// Allow users to provide base siteurl
// allow users to view the summary
// Have this viewed in a lead view
// have this stored on the org

import { crawl4aiClient } from '@/libs/crawl4ai.client';

export const ScrappingService = {
  scrapeSite: async (url: string) => {
    const markdown = await crawl4aiClient.crawl(url);
    return markdown;
  },
};
