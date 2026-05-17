export const ZOOMINFO_TOKEN_URL =
  process.env.ZOOMINFO_TOKEN_URL ?? 'https://api.zoominfo.com/gtm/oauth/v1/token';

export const ZOOMINFO_API_BASE = process.env.ZOOMINFO_API_BASE ?? 'https://api.zoominfo.com';

export const ZOOMINFO_REQUIRED_SCOPES = ['api:data:company', 'api:data:contact'] as const;

export const ZOOMINFO_SCOPE_REQUEST = [...ZOOMINFO_REQUIRED_SCOPES].join(' ');

export const ZOOMINFO_OAUTH_CACHE_PREFIX = 'zoominfo-oauth';

/** Redis TTL safety under token lifetime (seconds). */
export const ZOOMINFO_TOKEN_SKEW_SEC = 60;

export function zoominfoOAuthCacheKey(tenantId: string): string {
  return `tenant:${tenantId}:oauth_token`;
}
