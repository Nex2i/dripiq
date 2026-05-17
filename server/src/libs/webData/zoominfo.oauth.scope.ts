import { ZOOMINFO_REQUIRED_SCOPES } from '@/libs/webData/zoominfo.constants';
import { ZoomInfoInsufficientScopesError } from '@/exceptions/zoominfo.errors';
import {
  probeZoomInfoCompanySearch,
  probeZoomInfoContactSearch,
} from '@/libs/webData/zoominfo.probe';

export function parseZoomInfoGrantedScopes(scope?: string): string[] {
  if (!scope?.trim()) {
    return [];
  }
  return scope
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function assertZoomInfoRequiredScopesGranted(granted: string[]): void {
  const set = new Set(granted);
  const missing = ZOOMINFO_REQUIRED_SCOPES.filter((r) => !set.has(r));
  if (missing.length > 0) {
    throw new ZoomInfoInsufficientScopesError([...ZOOMINFO_REQUIRED_SCOPES], granted);
  }
}

/**
 * When the token grants explicit scopes, require Data API scopes. Otherwise probe minimal Data API calls.
 */
export async function ensureZoomInfoTokenCanAccessDataApis(
  accessToken: string,
  scopeFromTokenResponse?: string
): Promise<void> {
  const granted = parseZoomInfoGrantedScopes(scopeFromTokenResponse);
  if (granted.length > 0) {
    assertZoomInfoRequiredScopesGranted(granted);
    return;
  }
  await probeZoomInfoCompanySearch(accessToken);
  await probeZoomInfoContactSearch(accessToken);
}
