import { logger } from '@/libs/logger';
import { ZoomInfoApiError } from '@/exceptions/zoominfo.errors';
import {
  IWebDataProviderWithDomainSearch,
  WebDataSearchOptions,
  WebDataCompany,
  WebDataCompanyEmployeesResult,
  WebDataError,
} from '../interfaces/webData.interface';
import { ZoomInfoClient, pickBestCompanyForDomain } from '../zoominfo.client';
import { hostFromZoomInfoWebsite, normalizeWebsiteHost } from '../zoominfo.domain';
import { filterZoomInfoDecisionMakerContacts } from '../zoominfo.contacts.decision-maker';
import { mapZoomInfoContactToWebDataEmployee } from '../zoominfo.webdata-mapping';
import { getZoomInfoOAuthService } from '../zoominfo.oauth.service';

export class ZoomInfoWebDataProvider implements IWebDataProviderWithDomainSearch {
  public readonly providerName = 'ZoomInfo';

  private readonly client: ZoomInfoClient;

  constructor(
    private readonly tenantId: string,
    client?: ZoomInfoClient
  ) {
    this.client = client ?? new ZoomInfoClient(tenantId);
  }

  private adaptError(error: unknown): WebDataError {
    if (error instanceof ZoomInfoApiError) {
      return {
        message: error.message,
        code: 'ZOOMINFO_API_ERROR',
        statusCode: error.httpStatus,
        provider: this.providerName,
      };
    }
    const msg = error instanceof Error ? error.message : String(error);
    return {
      message: msg,
      code: 'ZOOMINFO_ERROR',
      statusCode: 500,
      provider: this.providerName,
    };
  }

  async getEmployeesByCompanyDomain(
    domain: string,
    options?: WebDataSearchOptions & { isDecisionMaker?: boolean }
  ): Promise<WebDataCompanyEmployeesResult> {
    try {
      logger.info('ZoomInfo provider: Getting employees by company domain', { domain, options });

      const host = normalizeWebsiteHost(domain);
      const companyResp = await this.client.searchCompaniesByDomain(domain);
      const companies = companyResp.data ?? [];
      const best = pickBestCompanyForDomain(companies, domain);

      if (!best) {
        const fallbackCompany: WebDataCompany = {
          id: 'unknown',
          name: 'Unknown',
          domain: host,
          website: host ? `https://${host}` : undefined,
        };
        return {
          company: fallbackCompany,
          employees: {
            current: [],
            former: [],
            total_current: 0,
            total_former: 0,
          },
          provider: this.providerName,
        };
      }

      const companyName = best.attributes?.name ?? 'Unknown';
      const limit = options?.limit ?? 25;
      const contactsResp = await this.client.searchContactsByCompanyName(companyName, limit);
      let contacts = contactsResp.data ?? [];

      if (options?.isDecisionMaker) {
        contacts = filterZoomInfoDecisionMakerContacts(contacts);
      }

      const websiteAttr = best.attributes?.website;
      const normalizedSite = websiteAttr ? hostFromZoomInfoWebsite(websiteAttr) : undefined;

      const company: WebDataCompany = {
        id: best.id,
        name: companyName,
        domain: host,
        website:
          normalizedSite && websiteAttr
            ? websiteAttr.startsWith('http')
              ? websiteAttr
              : `https://${normalizedSite}`
            : host
              ? `https://${host}`
              : undefined,
      };

      const adapted = contacts.map((c) => mapZoomInfoContactToWebDataEmployee(c));

      return {
        company,
        employees: {
          current: adapted,
          former: [],
          total_current: adapted.length,
          total_former: 0,
        },
        provider: this.providerName,
      };
    } catch (error) {
      logger.error('ZoomInfo provider: Get employees by company domain failed', {
        error,
        domain,
      });
      throw this.adaptError(error);
    }
  }

  async clearCache(pattern?: string): Promise<void> {
    await getZoomInfoOAuthService().invalidateTokenCache(this.tenantId);
    logger.info('ZoomInfo provider: OAuth token cache cleared for tenant', {
      tenantId: this.tenantId,
      pattern,
    });
  }

  async getCacheStats(): Promise<{ hits: number; misses: number; size: number }> {
    return { hits: 0, misses: 0, size: 0 };
  }
}
