import { hostFromZoomInfoWebsite, normalizeWebsiteHost } from '@/libs/webData/zoominfo.domain';
import type { ZoomInfoCompanyResource } from '@/libs/webData/zoominfo.types';

function scoreCompanyMatch(zoomWebsite: string | undefined, targetHost: string): number {
  const host = hostFromZoomInfoWebsite(zoomWebsite);
  if (!host) {
    return 0;
  }
  if (host === targetHost) {
    return 100;
  }
  if (host.endsWith(`.${targetHost}`)) {
    return 70;
  }
  if (host.includes(targetHost)) {
    return 40;
  }
  return 0;
}

export function pickBestCompanyForDomain(
  companies: ZoomInfoCompanyResource[],
  domainOrUrl: string
): ZoomInfoCompanyResource | null {
  if (!companies.length) {
    return null;
  }
  const targetHost = normalizeWebsiteHost(domainOrUrl);
  let best: ZoomInfoCompanyResource | null = null;
  let bestScore = -1;
  for (const c of companies) {
    const w = c.attributes?.website;
    const s = scoreCompanyMatch(w, targetHost);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return bestScore > 0 ? best : (companies[0] ?? null);
}
