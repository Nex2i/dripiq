import type { ZoomInfoContactResource } from '@/libs/webData/zoominfo.types';

const DECISION_MAKER_TITLE_HINTS = [
  'chief',
  'ceo',
  'cfo',
  'coo',
  'cto',
  'cio',
  'cmo',
  'president',
  'founder',
  'owner',
  'vp ',
  'vice president',
  'director',
  'head of',
];

export function filterZoomInfoDecisionMakerContacts(
  contacts: ZoomInfoContactResource[]
): ZoomInfoContactResource[] {
  return contacts.filter((c) => {
    const title = (c.attributes?.jobTitle ?? '').toLowerCase();
    const level = (c.attributes?.managementLevel ?? '').toLowerCase();
    if (!title && !level) {
      return false;
    }
    return (
      DECISION_MAKER_TITLE_HINTS.some((hint) => title.includes(hint)) ||
      level.includes('c-level') ||
      level.includes('director') ||
      level.includes('vp')
    );
  });
}
