import { pickBestCompanyForDomain } from '../zoominfo.company.pick';
import type { ZoomInfoCompanyResource } from '../zoominfo.types';

describe('pickBestCompanyForDomain', () => {
  it('prefers exact website host match', () => {
    const companies: ZoomInfoCompanyResource[] = [
      { id: '1', type: 'Company', attributes: { name: 'Wrong', website: 'other.com' } },
      { id: '2', type: 'Company', attributes: { name: 'Right', website: 'www.acme.io' } },
    ];
    const best = pickBestCompanyForDomain(companies, 'https://acme.io');
    expect(best?.id).toBe('2');
  });

  it('falls back to first company when no website match', () => {
    const companies: ZoomInfoCompanyResource[] = [
      { id: '9', type: 'Company', attributes: { name: 'Only', website: 'unrelated.net' } },
    ];
    const best = pickBestCompanyForDomain(companies, 'acme.io');
    expect(best?.id).toBe('9');
  });
});
