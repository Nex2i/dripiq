/**
 * Generic WebData interface for employee and company data providers
 * This abstraction allows for easy swapping of data providers (CoreSignal, Apollo, etc.)
 */

export interface WebDataSearchOptions {
  useCache?: boolean;
  cacheTtl?: number;
  limit?: number;
  offset?: number;
}

export interface EmployeeSearchFilters {
  company_name?: string;
  company_domain?: string;
  job_title?: string;
  job_department?: string;
  location?: string;
  skills?: string[];
  experience_level?: 'junior' | 'mid' | 'senior' | 'executive';
  keywords?: string;
}

export interface CompanySearchFilters {
  name?: string;
  domain?: string;
  industry?: string;
  location?: string;
  size?: string;
  employee_count_min?: number;
  employee_count_max?: number;
}

export interface WebDataEmployee {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  email?: string;
  job_title?: string;
  job_department?: string;
  job_level?: string;
  company_id?: string;
  company_name?: string;
  company_domain?: string;
  company_industry?: string;
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
  linkedin_url?: string;
  twitter_url?: string;
  github_url?: string;
  phone?: string;
  skills?: string[];
  experience?: WebDataExperience[];
  education?: WebDataEducation[];
  created_at?: string;
  updated_at?: string;
}

export interface WebDataExperience {
  company_name?: string;
  job_title?: string;
  start_date?: string;
  end_date?: string;
  duration?: string;
  description?: string;
  location?: string;
}

export interface WebDataEducation {
  institution?: string;
  degree?: string;
  field_of_study?: string;
  start_date?: string;
  end_date?: string;
  description?: string;
}

export interface WebDataCompany {
  id: string;
  name: string;
  domain?: string;
  website?: string;
  description?: string;
  industry?: string;
  sub_industry?: string;
  size?: string;
  size_range?: {
    min?: number;
    max?: number;
  };
  founded_year?: number;
  location?: {
    headquarters?: {
      country?: string;
      region?: string;
      city?: string;
      address?: string;
    };
    locations?: WebDataCompanyLocation[];
  };
  social_media?: {
    linkedin_url?: string;
    twitter_url?: string;
    facebook_url?: string;
  };
  technologies?: string[];
  revenue?: {
    amount?: number;
    currency?: string;
    year?: number;
  };
  employee_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface WebDataCompanyLocation {
  country?: string;
  region?: string;
  city?: string;
  address?: string;
  is_headquarters?: boolean;
}

export interface WebDataEmployeeSearchResult {
  employees: WebDataEmployee[];
  total_count: number;
  page: number;
  limit: number;
  provider: string;
}

export interface WebDataCompanySearchResult {
  companies: WebDataCompany[];
  total_count: number;
  page: number;
  limit: number;
  provider: string;
}

export interface WebDataCompanyEmployeesResult {
  company: WebDataCompany;
  employees: {
    current: WebDataEmployee[];
    former: WebDataEmployee[];
    total_current: number;
    total_former: number;
  };
  provider: string;
}

export interface WebDataError {
  message: string;
  code: string;
  statusCode: number;
  provider: string;
}

/**
 * Main WebData provider interface
 * All data providers must implement this interface
 */
export interface IWebDataProvider {
  readonly providerName: string;
  readonly isHealthy: boolean;

  // Employee methods
  /**
   * Search for employees
   * @param filters
   * @param options
   */
  searchEmployees(
    filters: EmployeeSearchFilters,
    options?: WebDataSearchOptions
  ): Promise<WebDataEmployeeSearchResult>;

  /**
   * Get an employee by ID
   * @param id
   * @param options
   */
  getEmployeeById(id: string, options?: WebDataSearchOptions): Promise<WebDataEmployee>;

  // Company methods
  /**
   * Search for companies
   * @param filters
   * @param options
   */
  searchCompanies(
    filters: CompanySearchFilters,
    options?: WebDataSearchOptions
  ): Promise<WebDataCompanySearchResult>;

  /**
   * Get a company by ID
   * @param id
   * @param options
   */
  getCompanyById(id: string, options?: WebDataSearchOptions): Promise<WebDataCompany>;

  /**
   * Get a company by domain
   * @param domain
   * @param options
   */
  getCompanyByDomain(domain: string, options?: WebDataSearchOptions): Promise<WebDataCompany>;

  // Combined methods
  /**
   * Get employees by company
   * @param companyIdentifier
   * @param options
   */
  getEmployeesByCompany(
    companyIdentifier: string,
    options?: WebDataSearchOptions & { includePastEmployees?: boolean }
  ): Promise<WebDataCompanyEmployeesResult>;

  /**
   * Get a company with all employees
   * @param companyIdentifier
   * @param options
   */
  getCompanyWithAllEmployees(
    companyIdentifier: string,
    options?: WebDataSearchOptions & { includePastEmployees?: boolean }
  ): Promise<WebDataCompanyEmployeesResult>;

  // Utility methods
  /**
   * Check the health of the provider
   */
  healthCheck(): Promise<boolean>;

  /**
   * Clear the cache
   * @param pattern
   */
  clearCache(pattern?: string): Promise<void>;

  /**
   * Get the cache stats
   */
  getCacheStats(): Promise<{ hits: number; misses: number; size: number }>;
}
