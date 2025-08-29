import {
  Queue,
  Worker,
  QueueEvents,
  QueueOptions,
  WorkerOptions,
  QueueEventsOptions,
} from 'bullmq';
import Redis, { type RedisOptions } from 'ioredis';
import { logger } from '@/libs/logger';
import { BULLMQ_PREFIX } from '@/config';
import { Processor } from 'bullmq/dist/esm/types/processor';

export type RedisConnectionOptions = RedisOptions & { maxRetriesPerRequest?: number | null };

let sharedRedisConnection: Redis | null = null;

export const createRedisConnection = (
  redisUrl?: string,
  overrides?: Partial<RedisConnectionOptions>
) => {
  if (sharedRedisConnection) return sharedRedisConnection;

  const url = redisUrl || process.env.REDIS_URL || '';
  if (!url) {
    const message =
      'REDIS_URL is required but missing. Set it in your environment to start the server.';
    logger.error(message);
    throw new Error(message);
  }

  const options: RedisConnectionOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
    ...(overrides || {}),
  };

  sharedRedisConnection = new Redis(url, options);

  sharedRedisConnection.on('error', (err) => {
    logger.error('Redis connection error', { err: String(err) });
  });

  sharedRedisConnection.on('connect', () => {
    logger.info('Redis connected');
  });

  sharedRedisConnection.on('close', () => {
    logger.warn('Redis connection closed');
  });

  return sharedRedisConnection;
};

export const getQueue = (name: string, queueOptions?: QueueOptions) => {
  const connection = createRedisConnection();
  return new Queue(name, {
    connection,
    prefix: BULLMQ_PREFIX || undefined,
    defaultJobOptions: {
      removeOnComplete: { age: 60 * 60, count: 1000 },
      removeOnFail: { age: 24 * 60 * 60 },
      attempts: 3,
      backoff: { type: 'exponential', delay: 500 },
    },
    ...(queueOptions || {}),
  });
};

export const getQueueEvents = (name: string, queueEventsOptions?: QueueEventsOptions) => {
  const connection = createRedisConnection();
  return new QueueEvents(name, {
    connection,
    prefix: BULLMQ_PREFIX || undefined,
    ...(queueEventsOptions || {}),
  });
};

const defaultWorkerOptions: Partial<WorkerOptions> = {
  concurrency: 5,
  lockDuration: 1000 * 60 * 5, // 5 minutes default
  lockRenewTime: 1000 * 60 * 2.5, // 2.5 minutes default
  maxStalledCount: 2, // Allow 2 stalls before failure
};

export const getWorker = <T = any, R = any, N extends string = string>(
  name: string,
  processor: Processor<T, R, N>,
  workerOptions?: Partial<WorkerOptions>
) => {
  const connection = createRedisConnection();
  const worker = new Worker<T, R, N>(name, processor, {
    connection,
    prefix: BULLMQ_PREFIX || undefined,
    concurrency: workerOptions?.concurrency ?? defaultWorkerOptions.concurrency,
    lockDuration: workerOptions?.lockDuration ?? defaultWorkerOptions.lockDuration,
    lockRenewTime: workerOptions?.lockRenewTime ?? defaultWorkerOptions.lockRenewTime,
    maxStalledCount: workerOptions?.maxStalledCount ?? defaultWorkerOptions.maxStalledCount,
    ...(workerOptions || {}),
  });

  worker.on('failed', (job, err) => {
    logger.error('BullMQ job failed', {
      queue: name,
      jobId: job?.id,
      name: (job as any)?.name,
      err: String(err),
    });
  });

  worker.on('completed', (job) => {
    logger.info('BullMQ job completed', { queue: name, jobId: job?.id, name: (job as any)?.name });
  });

  worker.on('error', (err) => {
    logger.error('BullMQ worker error', { queue: name, err: String(err) });
  });

  return worker;
};

export const shutdownQueues = async () => {
  try {
    await sharedRedisConnection?.quit();
  } catch (err) {
    logger.error('Error during Redis shutdown', { err: String(err) });
  } finally {
    sharedRedisConnection = null;
  }
};
