import {
  normalizeWebsiteHost,
  buildCompanySearchWebsiteFilter,
  hostFromZoomInfoWebsite,
} from '../zoominfo.domain';

describe('zoominfo.domain', () => {
  it('normalizeWebsiteHost strips protocol, path, and www', () => {
    expect(normalizeWebsiteHost('https://WWW.Example.COM/about')).toBe('example.com');
    expect(normalizeWebsiteHost('example.com')).toBe('example.com');
  });

  it('buildCompanySearchWebsiteFilter builds comma-separated http variants', () => {
    expect(buildCompanySearchWebsiteFilter('Example.COM')).toBe(
      'http://www.example.com,http://example.com'
    );
  });

  it('hostFromZoomInfoWebsite normalizes zoominfo-style website strings', () => {
    expect(hostFromZoomInfoWebsite('www.acme.io')).toBe('acme.io');
  });
});
