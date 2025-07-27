import { IUser } from '@/plugins/authentication.plugin';

// Simple in-memory cache with TTL for authentication data
interface CacheEntry {
  data: {
    user: IUser;
    userTenants: Array<{
      id: string;
      name: string;
      isSuperUser: boolean;
    }>;
  };
  expiresAt: number;
}

class AuthCache {
  private cache = new Map<string, CacheEntry>();
  private tokenCache = new Map<string, string>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  setToken(token: string): void {
    this.tokenCache.set(token, token);
  }

  getToken(token: string): string | null {
    return this.tokenCache.get(token) || null;
  }

  clearToken(token: string): void {
    this.tokenCache.delete(token);
  }

  set(supabaseId: string, data: CacheEntry['data']): void {
    this.cache.set(supabaseId, {
      data,
      expiresAt: Date.now() + this.TTL,
    });
  }

  get(supabaseId: string): CacheEntry['data'] | null {
    const entry = this.cache.get(supabaseId);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(supabaseId);
      return null;
    }

    return entry.data;
  }

  clear(supabaseId?: string): void {
    if (supabaseId) {
      this.cache.delete(supabaseId);
    } else {
      this.cache.clear();
    }
  }

  // Clean up expired entries periodically
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

export const authCache = new AuthCache();

// Run cleanup every 10 minutes
setInterval(
  () => {
    authCache.cleanup();
  },
  10 * 60 * 1000
);
