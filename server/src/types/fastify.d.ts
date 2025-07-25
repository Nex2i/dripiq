import { FastifyReply, FastifyRequest } from 'fastify';
import { Static } from '@fastify/type-provider-typebox';
import { schema } from '../utils/validateEnv';

declare module 'fastify' {
  interface FastifyInstance {
    authPrehandler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    firecrawlAuth: Record<string, any>;
    authCache: {
      clear: (supabaseId?: string) => void;
      cleanup: () => void;
    };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    config: Static<typeof schema>;
  }
}
