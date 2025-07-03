import { Embeddings } from 'openai/resources/embeddings';
import { openAiClient } from './openai.client';

export const openAiEmbeddingClient = {
  createEmbedding: async (text: string): Promise<Embeddings.CreateEmbeddingResponse> => {
    const embedding = await openAiClient.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float',
    });
    return embedding;
  },
};
