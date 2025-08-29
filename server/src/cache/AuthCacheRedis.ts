import { IUser } from '@/plugins/authentication.plugin';
import { sessionCacheClient } from '@/libs/cache-client';
import { logger } from '@/libs/logger';

interface AuthData {
  user: IUser;
  userTenants: Array<{
    id: string;
    name: string;
    isSuperUser: boolean;
  }>;
}

/**
 * Redis-based authentication cache using the cache manager
 * Replaces the in-memory AuthCache with distributed Redis storage
 */
class AuthCacheRedis {
  private readonly TTL = 5 * 60; // 5 minutes in seconds
  private readonly TOKEN_TTL = 60 * 60 * 24; // 24 hours for tokens

  /**
   * Set authentication token in cache
   */
  async setToken(token: string): Promise<void> {
    try {
      const key = `token:${token}`;
      await sessionCacheClient.setJson(key, { token, createdAt: Date.now() }, this.TOKEN_TTL);
      logger.debug('Auth token cached', { tokenHash: this.hashToken(token) });
    } catch (error) {
      logger.error('Failed to cache auth token', {
        error: String(error),
        tokenHash: this.hashToken(token),
      });
      throw error;
    }
  }

  /**
   * Get authentication token from cache
   */
  async getToken(token: string): Promise<string | null> {
    try {
      const key = `token:${token}`;
      const cached = await sessionCacheClient.getJson<{ token: string; createdAt: number }>(key);

      if (cached) {
        logger.debug('Auth token cache hit', { tokenHash: this.hashToken(token) });
        return cached.token;
      }

      logger.debug('Auth token cache miss', { tokenHash: this.hashToken(token) });
      return null;
    } catch (error) {
      logger.error('Failed to get auth token from cache', {
        error: String(error),
        tokenHash: this.hashToken(token),
      });
      return null;
    }
  }

  /**
   * Remove authentication token from cache
   */
  async clearToken(token: string): Promise<void> {
    try {
      const key = `token:${token}`;
      await sessionCacheClient.deleteSession(key);
      logger.debug('Auth token cleared', { tokenHash: this.hashToken(token) });
    } catch (error) {
      logger.error('Failed to clear auth token', {
        error: String(error),
        tokenHash: this.hashToken(token),
      });
    }
  }

  /**
   * Set user authentication data in cache
   */
  async set(supabaseId: string, data: AuthData): Promise<void> {
    try {
      const key = `auth:${supabaseId}`;
      const cacheData = {
        ...data,
        cachedAt: Date.now(),
      };

      await sessionCacheClient.setJson(key, cacheData, this.TTL);
      logger.debug('Auth data cached', { supabaseId, userTenants: data.userTenants.length });
    } catch (error) {
      logger.error('Failed to cache auth data', {
        error: String(error),
        supabaseId,
      });
      throw error;
    }
  }

  /**
   * Get user authentication data from cache
   */
  async get(supabaseId: string): Promise<AuthData | null> {
    try {
      const key = `auth:${supabaseId}`;
      const cached = await sessionCacheClient.getJson<AuthData & { cachedAt: number }>(key);

      if (cached) {
        logger.debug('Auth data cache hit', {
          supabaseId,
          age: Date.now() - cached.cachedAt,
        });

        // Remove cache metadata before returning
        const { cachedAt: _cachedAt, ...authData } = cached;
        return authData;
      }

      logger.debug('Auth data cache miss', { supabaseId });
      return null;
    } catch (error) {
      logger.error('Failed to get auth data from cache', {
        error: String(error),
        supabaseId,
      });
      return null;
    }
  }

  /**
   * Clear user authentication data from cache
   */
  async clear(supabaseId?: string): Promise<void> {
    try {
      if (supabaseId) {
        const key = `auth:${supabaseId}`;
        await sessionCacheClient.deleteSession(key);
        logger.debug('Auth data cleared for user', { supabaseId });
      } else {
        // Clear all auth data - use pattern deletion
        await sessionCacheClient.deleteUserCache('*', 'auth');
        logger.info('All auth data cleared');
      }
    } catch (error) {
      logger.error('Failed to clear auth data', {
        error: String(error),
        supabaseId,
      });
    }
  }

  /**
   * Check if user auth data exists in cache
   */
  async has(supabaseId: string): Promise<boolean> {
    try {
      const data = await this.get(supabaseId);
      return data !== null;
    } catch (error) {
      logger.error('Failed to check auth data existence', {
        error: String(error),
        supabaseId,
      });
      return false;
    }
  }

  /**
   * Get cache statistics for auth data
   */
  async getStats(): Promise<{
    totalUsers: number;
    totalTokens: number;
    cacheHealth: any;
  }> {
    try {
      const health = await sessionCacheClient.healthCheck();

      // Note: Getting exact counts would require scanning all keys
      // which is expensive. Consider implementing counters if needed.
      return {
        totalUsers: 0, // Would need implementation
        totalTokens: 0, // Would need implementation
        cacheHealth: health,
      };
    } catch (error) {
      logger.error('Failed to get auth cache stats', { error: String(error) });
      return {
        totalUsers: 0,
        totalTokens: 0,
        cacheHealth: { status: 'unhealthy', error: String(error) },
      };
    }
  }

  /**
   * Refresh TTL for existing auth data
   */
  async refresh(supabaseId: string): Promise<boolean> {
    try {
      const data = await this.get(supabaseId);
      if (data) {
        await this.set(supabaseId, data);
        logger.debug('Auth data TTL refreshed', { supabaseId });
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to refresh auth data TTL', {
        error: String(error),
        supabaseId,
      });
      return false;
    }
  }

  /**
   * Hash token for logging (security)
   */
  private hashToken(token: string): string {
    // Simple hash for logging purposes - not cryptographic
    let hash = 0;
    for (let i = 0; i < Math.min(token.length, 10); i++) {
      const char = token.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

export const authCacheRedis = new AuthCacheRedis();

// For backward compatibility, you can also export with the original name
export { authCacheRedis as authCache };
