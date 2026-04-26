import crypto from 'crypto';
import { createRedisConnection } from '@/libs/bullmq';
import { ConflictError, NotFoundError } from '@/exceptions/error';

export interface ScheduleHold {
  holdId: string;
  tenantId: string;
  userId: string;
  tokenId: string;
  slot: string;
}

const HOLD_TTL_SECONDS = 10;

export class LockService {
  async hold(input: Omit<ScheduleHold, 'holdId'>): Promise<{ holdId: string; expiresAt: Date }> {
    const redis = createRedisConnection();
    const holdId = crypto.randomBytes(24).toString('base64url');
    const key = this.key(input.userId, input.slot);
    const expiresAt = new Date(Date.now() + HOLD_TTL_SECONDS * 1000);
    const value: ScheduleHold = { ...input, holdId };

    const result = await redis.set(key, JSON.stringify(value), 'EX', HOLD_TTL_SECONDS, 'NX');
    if (result !== 'OK') {
      throw new ConflictError('Selected slot is temporarily held');
    }

    return { holdId, expiresAt };
  }

  async validate(holdId: string, userId: string, slot: string): Promise<ScheduleHold> {
    const redis = createRedisConnection();
    const value = await redis.get(this.key(userId, slot));
    if (!value) {
      throw new NotFoundError('Hold expired');
    }

    const hold = JSON.parse(value) as ScheduleHold;
    if (hold.holdId !== holdId) {
      throw new ConflictError('Hold does not match selected slot');
    }

    return hold;
  }

  async release(userId: string, slot: string, holdId: string): Promise<void> {
    const redis = createRedisConnection();
    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      end
      return 0
    `;
    const key = this.key(userId, slot);
    const value = await redis.get(key);
    if (!value) return;

    const hold = JSON.parse(value) as ScheduleHold;
    if (hold.holdId !== holdId) return;

    await redis.eval(script, 1, key, value);
  }

  private key(userId: string, slot: string): string {
    const date = new Date(slot);
    return `schedule:lock:${userId}:${date.toISOString().slice(0, 10)}:${date.toISOString()}`;
  }
}

export const lockService = new LockService();
