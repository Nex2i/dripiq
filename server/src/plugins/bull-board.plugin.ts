import { Buffer } from 'node:buffer';
import fp from 'fastify-plugin';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import { getQueue } from '@/libs/bullmq';
import { QUEUE_NAMES } from '@/constants/queues';
import { logger } from '@/libs/logger';

export default fp(async function bullBoardPlugin(app) {
  // Create queue instances for monitoring
  const leadAnalysisQueue = getQueue(QUEUE_NAMES.lead_analysis);
  const campaignCreationQueue = getQueue(QUEUE_NAMES.campaign_creation);
  const campaignExecutionQueue = getQueue(QUEUE_NAMES.campaign_execution);

  // Create the Fastify adapter for Bull-Board
  const serverAdapter = new FastifyAdapter();

  // Create the Bull-Board instance with the queues
  createBullBoard({
    queues: [
      new BullMQAdapter(leadAnalysisQueue),
      new BullMQAdapter(campaignCreationQueue),
      new BullMQAdapter(campaignExecutionQueue),
    ],
    serverAdapter,
  });

  // Set the base path for the Bull-Board UI
  serverAdapter.setBasePath('/admin/queues');

  // Register the Bull-Board routes
  await app.register(serverAdapter.registerPlugin(), {
    prefix: '/admin/queues',
  });

  // Add basic authentication middleware for the Bull-Board routes
  app.addHook('preHandler', async (request, reply) => {
    // Only apply auth to Bull-Board routes
    if (!request.url.startsWith('/admin/queues')) {
      return;
    }

    // Check for basic auth
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      reply.status(401).header('WWW-Authenticate', 'Basic realm="Bull-Board"');
      return reply.send('Authentication required');
    }

    // Decode basic auth
    const base64Credentials = authHeader.split(' ')[1];
    if (!base64Credentials) {
      reply.status(401).header('WWW-Authenticate', 'Basic realm="Bull-Board"');
      return reply.send('Invalid authorization header');
    }

    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    // Check credentials (you can customize these)
    const validUsername = process.env.BULL_BOARD_USERNAME || 'admin';
    const validPassword = process.env.BULL_BOARD_PASSWORD || 'admin123';

    if (username !== validUsername || password !== validPassword) {
      reply.status(401).header('WWW-Authenticate', 'Basic realm="Bull-Board"');
      return reply.send('Invalid credentials');
    }
  });

  logger.info('Bull-Board dashboard initialized', {
    path: '/admin/queues',
    queues: Object.values(QUEUE_NAMES),
  });
});
