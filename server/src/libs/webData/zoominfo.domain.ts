/**
 * Normalize user-provided domain or URL to a bare hostname (no scheme, no path, lowercase, no leading www).
 */
export function normalizeWebsiteHost(domainOrUrl: string): string {
  let s = domainOrUrl.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '');
  const slash = s.indexOf('/');
  if (slash >= 0) {
    s = s.substring(0, slash);
  }
  const colon = s.indexOf(':');
  if (colon >= 0) {
    s = s.substring(0, colon);
  }
  s = s.replace(/^www\./, '');
  return s;
}

/**
 * ZoomInfo company search accepts website in http://www.example.com format; comma-separated list allowed.
 */
export function buildCompanySearchWebsiteFilter(host: string): string {
  const h = normalizeWebsiteHost(host);
  return `http://www.${h},http://${h}`;
}

/**
 * Parse website from ZoomInfo company attributes (often "www.example.com" without scheme).
 */
export function hostFromZoomInfoWebsite(website?: string): string | undefined {
  if (!website?.trim()) {
    return undefined;
  }
  return normalizeWebsiteHost(website);
}
