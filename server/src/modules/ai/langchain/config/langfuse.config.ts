import { Langfuse } from 'langfuse';
import LangfuseTracer from 'langfuse-langchain';

// Initialize LangFuse client
export const langfuseClient = new Langfuse({
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
  environment: process.env.NODE_ENV || 'development',
  release: process.env.LANGFUSE_RELEASE || '1.0.0',
});

// Initialize LangFuse tracer for LangChain integration
export const langfuseTracer = new LangfuseTracer({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
});

// Create a wrapper function to handle LangFuse client creation with error handling
export function createLangfuseClient() {
  if (!process.env.LANGFUSE_SECRET_KEY || !process.env.LANGFUSE_PUBLIC_KEY) {
    console.warn('LangFuse credentials not provided. Tracing will be disabled.');
    return null;
  }

  try {
    return langfuseClient;
  } catch (error) {
    console.error('Failed to initialize LangFuse client:', error);
    return null;
  }
}

// Flush LangFuse client (should be called before app shutdown)
export async function flushLangfuse() {
  const client = createLangfuseClient();
  if (client) {
    await client.flush();
  }
}