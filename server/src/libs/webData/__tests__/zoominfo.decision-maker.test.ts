import { filterZoomInfoDecisionMakerContacts } from '../zoominfo.contacts.decision-maker';
import type { ZoomInfoContactResource } from '../zoominfo.types';

function contact(jobTitle?: string, managementLevel?: string): ZoomInfoContactResource {
  return {
    id: '1',
    type: 'contact',
    attributes: { jobTitle, managementLevel },
  };
}

describe('filterZoomInfoDecisionMakerContacts', () => {
  it('drops contacts with no role signals', () => {
    expect(filterZoomInfoDecisionMakerContacts([contact()])).toEqual([]);
  });

  it('keeps ceo title match', () => {
    const out = filterZoomInfoDecisionMakerContacts([contact('CEO')]);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('1');
  });

  it('keeps VP via managementLevel', () => {
    expect(filterZoomInfoDecisionMakerContacts([contact(undefined, 'vp')])).toHaveLength(1);
  });
});
