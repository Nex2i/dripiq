import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

class Crawl4AiClient {
  private baseURL = process.env.CRAWL_4_AI_URL;
  constructor() {}

  async crawl(url: string) {
    const response = await fetch(`${this.baseURL}/crawl`, {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }
}

export const crawl4aiClient = new Crawl4AiClient();
