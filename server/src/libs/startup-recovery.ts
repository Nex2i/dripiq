import type { Queue } from 'bullmq';
import { logger } from '@/libs/logger';
import { getQueue } from '@/libs/bullmq';
import { scheduledActionRepository } from '@/repositories';
import type { ScheduledAction } from '@/db/schema';
import { RECOVERY_CONFIG } from '@/config/recovery.config';

export interface RecoveryResult {
  total: number;
  recovered: number;
  failed: number;
  expired: number;
}

interface RecoveryActionResult {
  recovered: boolean;
  expired: boolean;
}

export class StartupRecovery {
  /**
   * Main recovery function to be called on server startup
   */
  static async recoverScheduledActions(): Promise<RecoveryResult> {
    if (!RECOVERY_CONFIG.ENABLED) {
      logger.info('Startup recovery is disabled, skipping...');
      return { total: 0, recovered: 0, failed: 0, expired: 0 };
    }

    const startTime = Date.now();
    logger.info('Starting scheduled actions recovery...');

    try {
      // Find orphaned actions (pending but not in BullMQ)
      const orphanedActions = await scheduledActionRepository.findOrphaned();

      logger.info(`Found ${orphanedActions.length} orphaned scheduled actions`);

      const results: RecoveryResult = {
        total: orphanedActions.length,
        recovered: 0,
        failed: 0,
        expired: 0,
      };

      // Process in batches to avoid overwhelming the system
      const batchSize = RECOVERY_CONFIG.BATCH_SIZE;
      for (let i = 0; i < orphanedActions.length; i += batchSize) {
        const batch = orphanedActions.slice(i, i + batchSize);

        for (const action of batch) {
          try {
            const result = await this.recoverScheduledAction(action);
            if (result.recovered) {
              results.recovered++;
            } else if (result.expired) {
              results.expired++;
            }
          } catch (error) {
            results.failed++;
            logger.error('Failed to recover scheduled action', {
              actionId: action.id,
              campaignId: action.campaignId,
              actionType: action.actionType,
              scheduledAt: action.scheduledAt,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      const duration = Date.now() - startTime;
      logger.info('Scheduled actions recovery completed', {
        ...results,
        durationMs: duration,
      });

      return results;
    } catch (error) {
      logger.error('Scheduled actions recovery failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Recover a single scheduled action
   */
  private static async recoverScheduledAction(
    action: ScheduledAction
  ): Promise<RecoveryActionResult> {
    const now = new Date();
    const scheduledTime = new Date(action.scheduledAt);

    // Check if action is expired (more than configured threshold past due)
    const expiredThreshold = RECOVERY_CONFIG.EXPIRY_THRESHOLD_MS;
    if (now.getTime() - scheduledTime.getTime() > expiredThreshold) {
      logger.warn('Scheduled action expired, marking as failed', {
        actionId: action.id,
        scheduledAt: action.scheduledAt,
        ageMs: now.getTime() - scheduledTime.getTime(),
      });

      await scheduledActionRepository.markAsExpired(action.id, 'Expired during recovery');
      return { recovered: false, expired: true };
    }

    // Calculate delay (0 if past due)
    const delay = Math.max(0, scheduledTime.getTime() - now.getTime());

    // Enqueue to appropriate queue
    const queue = this.getQueueForActionType(action.actionType);
    const jobId = this.generateJobId(action);

    await queue.add(
      this.getJobNameForActionType(action.actionType),
      {
        tenantId: action.tenantId,
        campaignId: action.campaignId,
        actionType: action.actionType,
        ...(action.payload || {}),
      },
      {
        delay,
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      }
    );

    // Update action status to processing and store the BullMQ job ID
    await scheduledActionRepository.updateById(action.id, {
      status: 'processing',
      bullmqJobId: jobId,
    });

    logger.info('Scheduled action recovered successfully', {
      actionId: action.id,
      campaignId: action.campaignId,
      actionType: action.actionType,
      delay,
      jobId,
    });

    return { recovered: true, expired: false };
  }

  /**
   * Get the appropriate queue for the action type
   */
  private static getQueueForActionType(actionType: string): Queue {
    switch (actionType) {
      case 'send':
      case 'timeout':
        return getQueue('campaign_execution');
      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }
  }

  /**
   * Get the appropriate job name for the action type
   */
  private static getJobNameForActionType(actionType: string): string {
    switch (actionType) {
      case 'send':
        return 'execute';
      case 'timeout':
        return 'timeout';
      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }
  }

  /**
   * Generate a unique job ID for recovery
   */
  private static generateJobId(action: ScheduledAction): string {
    const timestamp = new Date(action.scheduledAt).getTime();
    return `recovery:${action.actionType}:${action.campaignId}:${action.id}:${timestamp}`;
  }
}

// Export the main recovery function for easy usage
export const recoverScheduledActions = StartupRecovery.recoverScheduledActions;
