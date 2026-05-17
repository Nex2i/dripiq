import { logger } from '@/libs/logger';
import { CacheClient } from '@/libs/cache-client';
import { cacheManager } from '@/libs/cache';
import {
  ZOOMINFO_TOKEN_SKEW_SEC,
  ZOOMINFO_OAUTH_CACHE_PREFIX,
  zoominfoOAuthCacheKey,
} from '@/libs/webData/zoominfo.constants';
import type { CachedZoomInfoToken } from '@/libs/webData/zoominfo.types';
import { ZoomInfoApiError } from '@/exceptions/zoominfo.errors';
import { tenantZoominfoCredentialsRepository } from '@/repositories';
import { exchangeZoomInfoClientCredentials } from '@/libs/webData/zoominfo.oauth.token-exchange';
import { ensureZoomInfoTokenCanAccessDataApis } from '@/libs/webData/zoominfo.oauth.scope';

/**
 * ZoomInfo OAuth (client credentials) with Redis-cached access tokens and lazy refresh.
 */
export class ZoomInfoOAuthService {
  private readonly inflight = new Map<string, Promise<string>>();

  constructor(
    private readonly cache: CacheClient = new CacheClient(
      cacheManager,
      ZOOMINFO_OAUTH_CACHE_PREFIX
    ),
    private readonly credentialsRepository = tenantZoominfoCredentialsRepository
  ) {}

  async invalidateTokenCache(tenantId: string): Promise<void> {
    try {
      await cacheManager.del(zoominfoOAuthCacheKey(tenantId), {
        prefix: ZOOMINFO_OAUTH_CACHE_PREFIX,
      });
    } catch (error) {
      logger.warn('ZoomInfo OAuth cache delete failed', { tenantId, error: String(error) });
    }
  }

  async getAccessToken(tenantId: string): Promise<string> {
    const existing = await this.readValidCachedToken(tenantId);
    if (existing) {
      return existing;
    }

    let inflight = this.inflight.get(tenantId);
    if (!inflight) {
      inflight = this.fetchAndCacheToken(tenantId).finally(() => {
        this.inflight.delete(tenantId);
      });
      this.inflight.set(tenantId, inflight);
    }
    return inflight;
  }

  private async readValidCachedToken(tenantId: string): Promise<string | null> {
    const key = zoominfoOAuthCacheKey(tenantId);
    const cached = await this.cache.getJson<CachedZoomInfoToken>(key);
    if (!cached?.accessToken || !cached.expiresAtMs) {
      return null;
    }
    const skewMs = ZOOMINFO_TOKEN_SKEW_SEC * 1000;
    if (Date.now() >= cached.expiresAtMs - skewMs) {
      return null;
    }
    return cached.accessToken;
  }

  private async fetchAndCacheToken(tenantId: string): Promise<string> {
    const row = await this.credentialsRepository.findByTenantId(tenantId);
    if (!row) {
      throw new ZoomInfoApiError(400, 'ZoomInfo credentials are not configured for this tenant');
    }

    const clientSecret = this.credentialsRepository.getDecryptedSecret(row);

    const response = await exchangeZoomInfoClientCredentials({
      clientId: row.clientId,
      clientSecret,
      tenantId,
    });

    await ensureZoomInfoTokenCanAccessDataApis(response.access_token, response.scope);

    const ttlSec = Math.max(30, (response.expires_in ?? 600) - ZOOMINFO_TOKEN_SKEW_SEC);
    const expiresAtMs = Date.now() + ttlSec * 1000;
    const payload: CachedZoomInfoToken = {
      accessToken: response.access_token,
      expiresAtMs,
    };
    const key = zoominfoOAuthCacheKey(tenantId);
    await this.cache.setJson(key, payload, ttlSec);

    return response.access_token;
  }

  /**
   * Exchange credentials, validate scopes when present, otherwise probe Data APIs.
   */
  async validateConnectionCredentials(clientId: string, clientSecret: string): Promise<void> {
    const data = await exchangeZoomInfoClientCredentials({ clientId, clientSecret });
    await ensureZoomInfoTokenCanAccessDataApis(data.access_token, data.scope);
  }
}

let zoomInfoOAuthServiceSingleton: ZoomInfoOAuthService | null = null;

export function getZoomInfoOAuthService(): ZoomInfoOAuthService {
  if (!zoomInfoOAuthServiceSingleton) {
    zoomInfoOAuthServiceSingleton = new ZoomInfoOAuthService();
  }
  return zoomInfoOAuthServiceSingleton;
}

export function resetZoomInfoOAuthServiceForTests(): void {
  zoomInfoOAuthServiceSingleton = null;
}
