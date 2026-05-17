import axios from 'axios';
import { ZOOMINFO_API_BASE, ZOOMINFO_REQUIRED_SCOPES } from '@/libs/webData/zoominfo.constants';
import { ZoomInfoApiError, ZoomInfoInsufficientScopesError } from '@/exceptions/zoominfo.errors';
import type { ZoomInfoJsonApiError } from '@/libs/webData/zoominfo.types';

function summarizeZoomInfoFailure(status: number, data: unknown): string {
  const d = data as ZoomInfoJsonApiError | undefined;
  const first = d?.errors?.[0]?.detail || d?.detail || d?.title;
  return first ? String(first) : `HTTP ${status}`;
}

function assertNotForbidden(status: number, data: unknown, resourceLabel: string): void {
  if (status === 401 || status === 403) {
    throw new ZoomInfoInsufficientScopesError([...ZOOMINFO_REQUIRED_SCOPES], []);
  }
  if (status < 200 || status >= 300) {
    throw new ZoomInfoApiError(
      status,
      `ZoomInfo ${resourceLabel} probe failed: ${summarizeZoomInfoFailure(status, data)}`
    );
  }
}

/**
 * Minimal API calls to verify Data API access when the token response omits `scope`.
 */
export async function probeZoomInfoCompanySearch(accessToken: string): Promise<void> {
  const res = await axios.post(
    `${ZOOMINFO_API_BASE}/data/v1/companies/search`,
    {
      data: {
        type: 'CompanySearch',
        attributes: {
          companyName: 'ZoomInfo',
        },
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/vnd.api+json',
        Accept: 'application/vnd.api+json',
      },
      validateStatus: () => true,
    }
  );
  assertNotForbidden(res.status, res.data, 'company search');
}

export async function probeZoomInfoContactSearch(accessToken: string): Promise<void> {
  const res = await axios.post(
    `${ZOOMINFO_API_BASE}/data/v1/contacts/search`,
    {
      data: {
        type: 'ContactSearch',
        attributes: {
          companyName: 'ZoomInfo',
        },
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/vnd.api+json',
        Accept: 'application/vnd.api+json',
      },
      validateStatus: () => true,
    }
  );
  assertNotForbidden(res.status, res.data, 'contact search');
}
