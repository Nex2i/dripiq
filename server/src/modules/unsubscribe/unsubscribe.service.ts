import { contactUnsubscribeRepository } from '@/repositories/entities/ContactUnsubscribeRepository';
import { logger } from '@/libs/logger';

export class UnsubscribeService {
  async unsubscribeByChannel(
    tenantId: string,
    channel: string,
    channelValue: string,
    source: string,
    metadata?: {
      campaignId?: string;
      contactId?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    try {
      await contactUnsubscribeRepository.createUnsubscribe({
        tenantId,
        channel,
        channelValue,
        unsubscribeSource: source,
        ...metadata,
      });

      logger.info('Successfully unsubscribed channel', {
        tenantId,
        channel,
        channelValue,
        source,
        metadata,
      });
    } catch (error) {
      logger.error('Failed to unsubscribe channel', {
        tenantId,
        channel,
        channelValue,
        source,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async isChannelUnsubscribed(
    tenantId: string,
    channel: string,
    channelValue: string
  ): Promise<boolean> {
    try {
      const unsubscribe = await contactUnsubscribeRepository.findByChannelValue(
        tenantId,
        channel,
        channelValue
      );
      return !!unsubscribe;
    } catch (error) {
      logger.error('Failed to check unsubscribe status', {
        tenantId,
        channel,
        channelValue,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Fail open - don't block emails on database errors
      return false;
    }
  }

  async getUnsubscribedChannelValues(
    tenantId: string,
    channel: string,
    channelValues: string[]
  ): Promise<Set<string>> {
    try {
      const unsubscribes = await contactUnsubscribeRepository.findUnsubscribedChannelValues(
        tenantId,
        channel,
        channelValues
      );

      return new Set(unsubscribes.map(u => u.channelValue));
    } catch (error) {
      logger.error('Failed to get unsubscribed channel values', {
        tenantId,
        channel,
        channelValuesCount: channelValues.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Fail open - return empty set on errors
      return new Set();
    }
  }

  /**
   * Resubscribe a channel (remove unsubscribe record)
   * Note: This might be needed for admin functionality or user preference changes
   */
  async resubscribeByChannel(
    tenantId: string,
    channel: string,
    channelValue: string
  ): Promise<boolean> {
    try {
      const existing = await contactUnsubscribeRepository.findByChannelValue(
        tenantId,
        channel,
        channelValue
      );

      if (!existing) {
        logger.info('No unsubscribe record found to remove', {
          tenantId,
          channel,
          channelValue,
        });
        return false;
      }

      await contactUnsubscribeRepository.deleteByIdForTenant(existing.id, tenantId);

      logger.info('Successfully resubscribed channel', {
        tenantId,
        channel,
        channelValue,
        removedUnsubscribeId: existing.id,
      });

      return true;
    } catch (error) {
      logger.error('Failed to resubscribe channel', {
        tenantId,
        channel,
        channelValue,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get unsubscribe statistics for a tenant
   */
  async getUnsubscribeStats(tenantId: string, channel?: string) {
    try {
      let unsubscribes;
      
      if (channel) {
        // Get unsubscribes for specific channel
        unsubscribes = await contactUnsubscribeRepository.findAllForTenant(tenantId);
        unsubscribes = unsubscribes.filter(u => u.channel === channel);
      } else {
        // Get all unsubscribes for tenant
        unsubscribes = await contactUnsubscribeRepository.findAllForTenant(tenantId);
      }

      const stats = {
        total: unsubscribes.length,
        byChannel: unsubscribes.reduce((acc, u) => {
          acc[u.channel] = (acc[u.channel] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        bySource: unsubscribes.reduce((acc, u) => {
          acc[u.unsubscribeSource] = (acc[u.unsubscribeSource] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        recentUnsubscribes: unsubscribes
          .sort((a, b) => new Date(b.unsubscribedAt).getTime() - new Date(a.unsubscribedAt).getTime())
          .slice(0, 10), // Last 10 unsubscribes
      };

      logger.info('Generated unsubscribe stats', { 
        tenantId, 
        channel, 
        totalUnsubscribes: stats.total 
      });
      
      return stats;
      
    } catch (error) {
      logger.error('Failed to generate unsubscribe stats', {
        tenantId,
        channel,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Bulk check unsubscribe status for campaign optimization
   * Returns only the unsubscribed channel values for efficiency
   */
  async bulkCheckUnsubscribed(
    tenantId: string,
    channel: string,
    channelValues: string[]
  ): Promise<string[]> {
    try {
      const unsubscribedSet = await this.getUnsubscribedChannelValues(
        tenantId,
        channel,
        channelValues
      );

      return Array.from(unsubscribedSet);
    } catch (error) {
      logger.error('Failed to bulk check unsubscribe status', {
        tenantId,
        channel,
        channelValuesCount: channelValues.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Fail open - return empty array on errors
      return [];
    }
  }

  /**
   * Check if a specific campaign has caused unsubscribes
   */
  async getCampaignUnsubscribes(tenantId: string, campaignId: string) {
    try {
      const unsubscribes = await contactUnsubscribeRepository.findByCampaignForTenant(
        tenantId,
        campaignId
      );

      return {
        total: unsubscribes.length,
        unsubscribes: unsubscribes.map(u => ({
          id: u.id,
          channel: u.channel,
          channelValue: u.channelValue,
          unsubscribedAt: u.unsubscribedAt,
          source: u.unsubscribeSource,
        })),
      };
    } catch (error) {
      logger.error('Failed to get campaign unsubscribes', {
        tenantId,
        campaignId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}

export const unsubscribeService = new UnsubscribeService();