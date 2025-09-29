import { Langfuse } from 'langfuse';
import { LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST } from '@/config';
import { logger } from '@/libs/logger';

let langfuseClient: Langfuse | null = null;

export function getLangfuseClient(): Langfuse {
  if (!langfuseClient) {
    if (!LANGFUSE_PUBLIC_KEY || !LANGFUSE_SECRET_KEY) {
      throw new Error(
        'LangFuse credentials not configured. Please set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY environment variables.'
      );
    }

    langfuseClient = new Langfuse({
      publicKey: LANGFUSE_PUBLIC_KEY,
      secretKey: LANGFUSE_SECRET_KEY,
      baseUrl: LANGFUSE_HOST || 'https://cloud.langfuse.com',
    });

    logger.info('LangFuse client initialized');
  }

  return langfuseClient;
}
