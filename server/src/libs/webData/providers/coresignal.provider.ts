import { logger } from '@/libs/logger';
import { CoreSignalClient } from '../coresignal.client';
import {
  IWebDataProvider,
  WebDataSearchOptions,
  EmployeeSearchFilters,
  CompanySearchFilters,
  WebDataEmployee,
  WebDataCompany,
  WebDataEmployeeSearchResult,
  WebDataCompanySearchResult,
  WebDataCompanyEmployeesResult,
  WebDataError,
} from '../interfaces/webData.interface';
import {
  Employee,
  Company,
  EmployeeSearchResponse,
  CompanySearchResponse,
  CompanyWithEmployees,
  CoreSignalError,
} from '../types';

/**
 * CoreSignal implementation of the WebData provider interface
 * Adapts CoreSignal API responses to the generic WebData interface
 */
export class CoreSignalWebDataProvider implements IWebDataProvider {
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
   * Convert CoreSignal employee to WebData employee format
   */
  private adaptEmployee(employee: Employee): WebDataEmployee {
    return {
      id: employee.id,
      first_name: employee.first_name,
      last_name: employee.last_name,
      full_name: employee.full_name,
      email: employee.email,
      job_title: employee.job_title,
      job_department: employee.job_department,
      job_level: employee.job_level,
      company_id: employee.company_id,
      company_name: employee.company_name,
      company_domain: employee.company_domain,
      company_industry: employee.company_industry,
      location: employee.location
        ? {
            country: employee.location.country,
            region: employee.location.region,
            city: employee.location.city,
          }
        : undefined,
      linkedin_url: employee.linkedin_url,
      twitter_url: employee.twitter_url,
      github_url: employee.github_url,
      phone: employee.phone,
      skills: employee.skills,
      experience: employee.experience?.map((exp) => ({
        company_name: exp.company_name,
        job_title: exp.job_title,
        start_date: exp.start_date,
        end_date: exp.end_date,
        duration: exp.duration,
        description: exp.description,
        location: exp.location,
      })),
      education: employee.education?.map((edu) => ({
        institution: edu.institution,
        degree: edu.degree,
        field_of_study: edu.field_of_study,
        start_date: edu.start_date,
        end_date: edu.end_date,
        description: edu.description,
      })),
      created_at: employee.created_at,
      updated_at: employee.updated_at,
    };
  }

  /**
   * Convert CoreSignal company to WebData company format
   */
  private adaptCompany(company: Company): WebDataCompany {
    return {
      id: company.id,
      name: company.name,
      domain: company.domain,
      website: company.website,
      description: company.description,
      industry: company.industry,
      sub_industry: company.sub_industry,
      size: company.size,
      size_range: company.size_range,
      founded_year: company.founded_year,
      location: company.location
        ? {
            headquarters: company.location.headquarters,
            locations: company.location.locations?.map((loc) => ({
              country: loc.country,
              region: loc.region,
              city: loc.city,
              address: loc.address,
              is_headquarters: loc.is_headquarters,
            })),
          }
        : undefined,
      social_media: company.social_media,
      technologies: company.technologies,
      revenue: company.revenue,
      employee_count: company.employee_count,
      created_at: company.created_at,
      updated_at: company.updated_at,
    };
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
   * Convert WebData search filters to CoreSignal query format
   */
  private adaptEmployeeFilters(filters: EmployeeSearchFilters) {
    return {
      company_name: filters.company_name,
      company_domain: filters.company_domain,
      job_title: filters.job_title,
      location: filters.location,
      skills: filters.skills,
      experience_level: filters.experience_level,
      keywords: filters.keywords,
    };
  }

  /**
   * Convert WebData company filters to CoreSignal query format
   */
  private adaptCompanyFilters(filters: CompanySearchFilters) {
    return {
      name: filters.name,
      domain: filters.domain,
      industry: filters.industry,
      location: filters.location,
      size: filters.size,
    };
  }

  /**
   * Search for employees
   */
  async searchEmployees(
    filters: EmployeeSearchFilters,
    options?: WebDataSearchOptions
  ): Promise<WebDataEmployeeSearchResult> {
    try {
      logger.info('CoreSignal provider: Searching employees', { filters, options });

      const query = {
        ...this.adaptEmployeeFilters(filters),
        limit: options?.limit,
        offset: options?.offset,
      };

      const result: EmployeeSearchResponse = await this.client.searchEmployees(query, {
        useCache: options?.useCache,
        cacheTtl: options?.cacheTtl,
      });

      return {
        employees: result.employees.map((emp) => this.adaptEmployee(emp)),
        total_count: result.total_count,
        page: result.page,
        limit: result.limit,
        provider: this.providerName,
      };
    } catch (error) {
      logger.error('CoreSignal provider: Employee search failed', { error, filters });
      this._isHealthy = false;
      throw this.adaptError(error as CoreSignalError);
    }
  }

  /**
   * Get employee by ID
   */
  async getEmployeeById(id: string, options?: WebDataSearchOptions): Promise<WebDataEmployee> {
    try {
      logger.info('CoreSignal provider: Getting employee by ID', { id, options });

      const employee = await this.client.getEmployeeById(id, {
        useCache: options?.useCache,
        cacheTtl: options?.cacheTtl,
      });

      return this.adaptEmployee(employee);
    } catch (error) {
      logger.error('CoreSignal provider: Get employee by ID failed', { error, id });
      this._isHealthy = false;
      throw this.adaptError(error as CoreSignalError);
    }
  }

  /**
   * Search for companies
   */
  async searchCompanies(
    filters: CompanySearchFilters,
    options?: WebDataSearchOptions
  ): Promise<WebDataCompanySearchResult> {
    try {
      logger.info('CoreSignal provider: Searching companies', { filters, options });

      const query = {
        ...this.adaptCompanyFilters(filters),
        limit: options?.limit,
        offset: options?.offset,
      };

      const result: CompanySearchResponse = await this.client.searchCompanies(query, {
        useCache: options?.useCache,
        cacheTtl: options?.cacheTtl,
      });

      return {
        companies: result.companies.map((comp) => this.adaptCompany(comp)),
        total_count: result.total_count,
        page: result.page,
        limit: result.limit,
        provider: this.providerName,
      };
    } catch (error) {
      logger.error('CoreSignal provider: Company search failed', { error, filters });
      this._isHealthy = false;
      throw this.adaptError(error as CoreSignalError);
    }
  }

  /**
   * Get company by ID
   */
  async getCompanyById(id: string, options?: WebDataSearchOptions): Promise<WebDataCompany> {
    try {
      logger.info('CoreSignal provider: Getting company by ID', { id, options });

      const company = await this.client.getCompanyById(id, {
        useCache: options?.useCache,
        cacheTtl: options?.cacheTtl,
      });

      return this.adaptCompany(company);
    } catch (error) {
      logger.error('CoreSignal provider: Get company by ID failed', { error, id });
      this._isHealthy = false;
      throw this.adaptError(error as CoreSignalError);
    }
  }

  /**
   * Get company by domain
   */
  async getCompanyByDomain(
    domain: string,
    options?: WebDataSearchOptions
  ): Promise<WebDataCompany> {
    try {
      logger.info('CoreSignal provider: Getting company by domain', { domain, options });

      const company = await this.client.getCompanyByDomain(domain, {
        useCache: options?.useCache,
        cacheTtl: options?.cacheTtl,
      });

      return this.adaptCompany(company);
    } catch (error) {
      logger.error('CoreSignal provider: Get company by domain failed', { error, domain });
      this._isHealthy = false;
      throw this.adaptError(error as CoreSignalError);
    }
  }

  /**
   * Get employees by company
   */
  async getEmployeesByCompany(
    companyIdentifier: string,
    options?: WebDataSearchOptions & { includePastEmployees?: boolean }
  ): Promise<WebDataCompanyEmployeesResult> {
    try {
      logger.info('CoreSignal provider: Getting employees by company', {
        companyIdentifier,
        options,
      });

      const result: CompanyWithEmployees = await this.client.getEmployeesByCompany(
        companyIdentifier,
        {
          useCache: options?.useCache,
          cacheTtl: options?.cacheTtl,
          includePastEmployees: options?.includePastEmployees,
        }
      );

      return {
        company: this.adaptCompany(result.company),
        employees: {
          current: result.employees.current.map((emp) => this.adaptEmployee(emp)),
          former: result.employees.former.map((emp) => this.adaptEmployee(emp)),
          total_current: result.employees.total_current,
          total_former: result.employees.total_former,
        },
        provider: this.providerName,
      };
    } catch (error) {
      logger.error('CoreSignal provider: Get employees by company failed', {
        error,
        companyIdentifier,
      });
      this._isHealthy = false;
      throw this.adaptError(error as CoreSignalError);
    }
  }

  /**
   * Get company with all employees (primary use case)
   */
  async getCompanyWithAllEmployees(
    companyIdentifier: string,
    options?: WebDataSearchOptions & { includePastEmployees?: boolean }
  ): Promise<WebDataCompanyEmployeesResult> {
    try {
      logger.info('CoreSignal provider: Getting company with all employees', {
        companyIdentifier,
        options,
      });

      const result = await this.client.getCompanyWithAllEmployees(companyIdentifier, {
        useCache: options?.useCache,
        cacheTtl: options?.cacheTtl,
        includePastEmployees: options?.includePastEmployees,
      });

      return {
        company: this.adaptCompany(result.company),
        employees: {
          current: result.employees.employees.current.map((emp: Employee) =>
            this.adaptEmployee(emp)
          ),
          former: result.employees.employees.former.map((emp: Employee) => this.adaptEmployee(emp)),
          total_current: result.employees.employees.total_current,
          total_former: result.employees.employees.total_former,
        },
        provider: this.providerName,
      };
    } catch (error) {
      logger.error('CoreSignal provider: Get company with all employees failed', {
        error,
        companyIdentifier,
      });
      this._isHealthy = false;
      throw this.adaptError(error as CoreSignalError);
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try a simple search to verify the API is working
      await this.client.searchCompanies({ name: 'test', limit: 1 }, { useCache: false });
      this._isHealthy = true;
      logger.debug('CoreSignal provider: Health check passed');
      return true;
    } catch (error) {
      this._isHealthy = false;
      logger.warn('CoreSignal provider: Health check failed', { error });
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
