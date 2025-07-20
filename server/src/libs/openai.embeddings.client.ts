import { OpenAIEmbeddings } from '@langchain/openai';

export const openAiEmbeddingClient = new OpenAIEmbeddings({
  modelName: 'text-embedding-3-small',
  openAIApiKey: process.env.OPENAI_API_KEY,
  dimensions: 1536,
});
