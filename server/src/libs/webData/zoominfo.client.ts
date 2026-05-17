import axios from 'axios';
import { ZOOMINFO_API_BASE } from '@/libs/webData/zoominfo.constants';
import type {
  ZoomInfoCompanySearchResponse,
  ZoomInfoContactSearchResponse,
  ZoomInfoJsonApiError,
} from '@/libs/webData/zoominfo.types';
import { ZoomInfoApiError } from '@/exceptions/zoominfo.errors';
import {
  buildCompanySearchWebsiteFilter,
  normalizeWebsiteHost,
} from '@/libs/webData/zoominfo.domain';
import {
  getZoomInfoOAuthService,
  ZoomInfoOAuthService,
} from '@/libs/webData/zoominfo.oauth.service';

function summarizeError(status: number, data: unknown): string {
  const d = data as ZoomInfoJsonApiError | undefined;
  const first = d?.errors?.[0]?.detail || d?.detail || d?.title;
  return first ? String(first) : `HTTP ${status}`;
}

export class ZoomInfoClient {
  constructor(
    private readonly tenantId: string,
    private readonly oauth: ZoomInfoOAuthService = getZoomInfoOAuthService()
  ) {}

  private async authorizedPost<T>(path: string, body: unknown): Promise<T> {
    const token = await this.oauth.getAccessToken(this.tenantId);
    const res = await axios.post<T>(`${ZOOMINFO_API_BASE}${path}`, body, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/vnd.api+json',
        Accept: 'application/vnd.api+json',
      },
      validateStatus: () => true,
    });

    if (res.status < 200 || res.status >= 300) {
      throw new ZoomInfoApiError(
        res.status,
        `ZoomInfo API ${path} failed: ${summarizeError(res.status, res.data)}`
      );
    }
    return res.data;
  }

  async searchCompaniesByDomain(domainOrUrl: string): Promise<ZoomInfoCompanySearchResponse> {
    const host = normalizeWebsiteHost(domainOrUrl);
    const website = buildCompanySearchWebsiteFilter(host);
    return this.authorizedPost<ZoomInfoCompanySearchResponse>('/data/v1/companies/search', {
      data: {
        type: 'CompanySearch',
        attributes: { website },
      },
    });
  }

  async searchContactsByCompanyName(
    companyName: string,
    pageSize: number
  ): Promise<ZoomInfoContactSearchResponse> {
    const size = Math.min(100, Math.max(1, pageSize));
    return this.authorizedPost<ZoomInfoContactSearchResponse>(
      `/data/v1/contacts/search?page[size]=${size}&page[number]=1`,
      {
        data: {
          type: 'ContactSearch',
          attributes: { companyName },
        },
      }
    );
  }
}

export { pickBestCompanyForDomain } from '@/libs/webData/zoominfo.company.pick';
