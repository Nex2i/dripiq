import { cacheManager } from '@/libs/cache';
import { DashboardMetrics } from '@/modules/dashboard.service';

export interface DashboardCacheState {
  metrics: DashboardMetrics | null;
}

class DashboardCache {
  private readonly TTL = 60 * 5; // 5 minutes

  async getMetrics(tenantId: string, query?: object): Promise<DashboardCacheState | null> {
    const key = `dashboard:metrics:${tenantId}:${JSON.stringify(query)}`;
    return await cacheManager.get<DashboardCacheState>(key);
  }

  async setMetrics(tenantId: string, metrics: DashboardMetrics, query?: object): Promise<void> {
    const key = `dashboard:metrics:${tenantId}:${JSON.stringify(query)}`;
    await cacheManager.set(key, { metrics }, { ttl: this.TTL });
  }
}

export const dashboardCache = new DashboardCache();
