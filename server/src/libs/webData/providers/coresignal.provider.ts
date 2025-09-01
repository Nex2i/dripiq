import { logger } from '@/libs/logger';
import { CoreSignalClient } from '../coresignal.client';
import {
  IWebDataProviderWithDomainSearch,
  WebDataSearchOptions,
  WebDataCompany,
  WebDataCompanyEmployeesResult,
  WebDataError,
} from '../interfaces/webData.interface';
import { CoreSignalError, CoreSignalEmployeeCollectionResponse } from '../types';

/**
 * CoreSignal implementation of the WebData provider interface
 * Adapted for v2 multi-source API
 */
export class CoreSignalWebDataProvider implements IWebDataProviderWithDomainSearch {
  public readonly providerName = 'CoreSignal';
  private client: CoreSignalClient;
  private _isHealthy = true;

  constructor(client?: CoreSignalClient) {
    this.client = client || new CoreSignalClient();
  }

  public get isHealthy(): boolean {
    return this._isHealthy;
  }

  /**
   * Convert CoreSignal error to WebData error format
   */
  private adaptError(error: CoreSignalError): WebDataError {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      provider: this.providerName,
    };
  }

  /**
   * Convert CoreSignal multi-source employee to WebData employee format
   */
  private adaptMultiSourceEmployee(
    employee: CoreSignalEmployeeCollectionResponse
  ): WebDataEmployee {
    const activeExperience = employee.experience?.find((exp) => exp.active_experience === 1);

    return {
      id: employee.id.toString(),
      first_name: employee.first_name,
      last_name: employee.last_name,
      full_name: employee.full_name,
      email: employee.primary_professional_email,
      job_title: employee.active_experience_title || activeExperience?.position_title,
      job_department: employee.active_experience_department || activeExperience?.department,
      job_level: employee.active_experience_management_level || activeExperience?.management_level,
      company_id: employee.active_experience_company_id?.toString(),
      company_name: activeExperience?.company_name,
      company_domain: activeExperience?.company_website,
      company_industry: activeExperience?.company_industry,
      location: {
        country: employee.location_country,
        region: employee.location_regions?.[0],
        city: employee.location_full?.split(',')?.[0]?.trim(),
      },
      linkedin_url: employee.linkedin_url,
      skills: employee.inferred_skills,
      experience: employee.experience?.map((exp) => ({
        company_name: exp.company_name,
        job_title: exp.position_title,
        start_date: exp.date_from,
        end_date: exp.date_to || undefined,
        description: exp.description,
        location: exp.location,
      })),
      education: employee.education?.map((edu) => ({
        institution: edu.institution_name,
        degree: edu.degree,
        field_of_study: undefined, // Not available in multi-source response
        start_date: edu.date_from_year?.toString(),
        end_date: edu.date_to_year?.toString(),
        description: edu.description || undefined,
      })),
      created_at: employee.created_at,
      updated_at: employee.updated_at,
    };
  }

  /**
   * Get employees by company domain using multi-source API
   */
  async getEmployeesByCompanyDomain(
    domain: string,
    options?: WebDataSearchOptions & { isDecisionMaker?: boolean }
  ): Promise<WebDataCompanyEmployeesResult> {
    try {
      logger.info('CoreSignal provider: Getting employees by company domain', { domain, options });

      const employees = await this.client.getEmployeesByCompanyDomain(domain, {
        useCache: options?.useCache,
        cacheTtl: options?.cacheTtl,
        isDecisionMaker: options?.isDecisionMaker,
      });

      const adaptedEmployees = employees.map((emp) => this.adaptMultiSourceEmployee(emp));

      // Create a mock company object since we don't have company data from the search
      const mockCompany: WebDataCompany = {
        id: 'unknown',
        name: 'Unknown',
        domain: domain,
        website: `https://${domain}`,
      };

      return {
        company: mockCompany,
        employees: {
          current: adaptedEmployees,
          former: [], // Multi-source API doesn't distinguish former employees in this context
          total_current: adaptedEmployees.length,
          total_former: 0,
        },
        provider: this.providerName,
      };
    } catch (error) {
      logger.error('CoreSignal provider: Get employees by company domain failed', {
        error,
        domain,
      });
      this._isHealthy = false;
      throw this.adaptError(error as CoreSignalError);
    }
  }



  /**
   * Check the health of the provider
   */
  async healthCheck(): Promise<boolean> {
    try {
      const isHealthy = await this.client.healthCheck();
      this._isHealthy = isHealthy;
      return isHealthy;
    } catch (error) {
      logger.error('CoreSignal provider: Health check failed', { error });
      this._isHealthy = false;
      return false;
    }
  }

  /**
   * Clear cache
   */
  async clearCache(pattern?: string): Promise<void> {
    try {
      await this.client.clearCache(pattern);
      logger.info('CoreSignal provider: Cache cleared', { pattern });
    } catch (error) {
      logger.error('CoreSignal provider: Clear cache failed', { error, pattern });
      throw this.adaptError(error as CoreSignalError);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{ hits: number; misses: number; size: number }> {
    try {
      const stats = await this.client.getCacheStats();
      logger.debug('CoreSignal provider: Cache stats retrieved', { stats });
      return stats;
    } catch (error) {
      logger.error('CoreSignal provider: Get cache stats failed', { error });
      throw this.adaptError(error as CoreSignalError);
    }
  }
}
