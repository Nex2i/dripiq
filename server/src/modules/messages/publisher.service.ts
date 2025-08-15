import { getQueue } from '@/libs/bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '@/constants/queues';

export type PublishMessagePayload = {
  tenantId: string;
  userId: string;
  content: string;
  metadata?: Record<string, unknown>;
};

export class MessagePublisherService {
  private static queue = getQueue(QUEUE_NAMES.messages);

  static async publish(payload: PublishMessagePayload) {
    return this.queue.add(JOB_NAMES.messages.process, payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 500 },
    });
  }
}