import { createHash } from 'crypto';
import { cacheManager } from '@/libs/cache';
import { DashboardMetrics } from '@/modules/dashboard.service';

export interface DashboardCacheState {
  metrics: DashboardMetrics | null;
}

class DashboardCache {
  private readonly TTL = 60 * 5; // 5 minutes

  async getMetrics(tenantId: string, query?: object): Promise<DashboardCacheState | null> {
    const queryHash = query ? this.hashQueryObject(query) : 'no-query';
    const key = `dashboard:metrics:${tenantId}:${queryHash}`;
    return await cacheManager.get<DashboardCacheState>(key);
  }

  async setMetrics(tenantId: string, metrics: DashboardMetrics, query?: object): Promise<void> {
    const queryHash = query ? this.hashQueryObject(query) : 'no-query';
    const key = `dashboard:metrics:${tenantId}:${queryHash}`;
    await cacheManager.set(key, { metrics }, { ttl: this.TTL });
  }

  private hashQueryObject(query: object): string {
    // Create a normalized JSON string for consistent hashing
    const normalizedJson = JSON.stringify(query, Object.keys(query).sort());
    return createHash('sha256').update(normalizedJson).digest('hex').substring(0, 16); // Use first 16 chars for reasonable key length
  }
}

export const dashboardCache = new DashboardCache();
