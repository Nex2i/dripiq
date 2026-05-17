import axios from 'axios';
import { logger } from '@/libs/logger';
import { CacheClient } from '@/libs/cache-client';
import { cacheManager } from '@/libs/cache';
import {
  ZOOMINFO_REQUIRED_SCOPES,
  ZOOMINFO_SCOPE_REQUEST,
  ZOOMINFO_TOKEN_SKEW_SEC,
  ZOOMINFO_TOKEN_URL,
  ZOOMINFO_OAUTH_CACHE_PREFIX,
  zoominfoOAuthCacheKey,
} from '@/libs/webData/zoominfo.constants';
import type { CachedZoomInfoToken, ZoomInfoTokenResponse } from '@/libs/webData/zoominfo.types';
import { ZoomInfoApiError, ZoomInfoInsufficientScopesError } from '@/exceptions/zoominfo.errors';
import { tenantZoominfoCredentialsRepository } from '@/repositories';
import {
  probeZoomInfoCompanySearch,
  probeZoomInfoContactSearch,
} from '@/libs/webData/zoominfo.probe';

function parseScopeList(scope?: string): string[] {
  if (!scope?.trim()) {
    return [];
  }
  return scope
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function assertRequiredScopes(granted: string[]): void {
  const set = new Set(granted);
  const missing = ZOOMINFO_REQUIRED_SCOPES.filter((r) => !set.has(r));
  if (missing.length > 0) {
    throw new ZoomInfoInsufficientScopesError([...ZOOMINFO_REQUIRED_SCOPES], granted);
  }
}

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

    const body = new URLSearchParams();
    body.set('grant_type', 'client_credentials');
    body.set('scope', ZOOMINFO_SCOPE_REQUEST);

    let response: ZoomInfoTokenResponse;
    try {
      const axiosResponse = await axios.post<ZoomInfoTokenResponse>(
        ZOOMINFO_TOKEN_URL,
        body.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            Authorization: `Basic ${Buffer.from(`${row.clientId}:${clientSecret}`).toString('base64')}`,
          },
          validateStatus: () => true,
        }
      );

      if (axiosResponse.status < 200 || axiosResponse.status >= 300) {
        const msg =
          typeof axiosResponse.data === 'object' &&
          axiosResponse.data &&
          'error' in axiosResponse.data
            ? String((axiosResponse.data as { error?: string }).error)
            : `HTTP ${axiosResponse.status}`;
        throw new ZoomInfoApiError(axiosResponse.status, `ZoomInfo token request failed: ${msg}`);
      }
      response = axiosResponse.data;
    } catch (e) {
      if (e instanceof ZoomInfoApiError) {
        throw e;
      }
      logger.error('ZoomInfo token exchange failed', { tenantId, error: String(e) });
      throw new ZoomInfoApiError(500, `ZoomInfo token exchange failed: ${String(e)}`);
    }

    const granted = parseScopeList(response.scope);
    if (granted.length > 0) {
      assertRequiredScopes(granted);
    } else {
      await probeZoomInfoCompanySearch(response.access_token);
      await probeZoomInfoContactSearch(response.access_token);
    }

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
    const body = new URLSearchParams();
    body.set('grant_type', 'client_credentials');
    body.set('scope', ZOOMINFO_SCOPE_REQUEST);

    const axiosResponse = await axios.post<ZoomInfoTokenResponse>(
      ZOOMINFO_TOKEN_URL,
      body.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
        validateStatus: () => true,
      }
    );

    if (axiosResponse.status < 200 || axiosResponse.status >= 300) {
      const msg =
        typeof axiosResponse.data === 'object' &&
        axiosResponse.data &&
        'error' in axiosResponse.data
          ? String((axiosResponse.data as { error?: string }).error)
          : `HTTP ${axiosResponse.status}`;
      throw new ZoomInfoApiError(axiosResponse.status, `ZoomInfo token request failed: ${msg}`);
    }

    const granted = parseScopeList(axiosResponse.data.scope);
    if (granted.length > 0) {
      assertRequiredScopes(granted);
    } else {
      await probeZoomInfoCompanySearch(axiosResponse.data.access_token);
      await probeZoomInfoContactSearch(axiosResponse.data.access_token);
    }
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
