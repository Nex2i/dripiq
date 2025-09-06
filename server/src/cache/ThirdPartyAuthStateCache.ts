import { cacheManager } from '@/libs/cache';

export interface ThirdPartyAuthState {
  tenantId: string;
  userId: string;
  isNewMailAccount: boolean;
}

class ThirdPartyAuthStateCache {
  private readonly TTL = 60 * 60 * 24; // 24 hours

  async createAndSet(state: ThirdPartyAuthState): Promise<string> {
    const stateId = generateState();
    await cacheManager.set(`third-party-auth-state:${stateId}`, state, { ttl: this.TTL });
    return stateId;
  }

  async state(stateId: string): Promise<ThirdPartyAuthState | null> {
    return await cacheManager.get(`third-party-auth-state:${stateId}`);
  }

  async clear(stateId: string): Promise<void> {
    await cacheManager.del(`third-party-auth-state:${stateId}`);
  }
}

export const thirdPartyAuthStateCache = new ThirdPartyAuthStateCache();

// Generate secure random state for CSRF protection
export function generateState(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
