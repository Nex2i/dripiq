/**
 * CoreSignal API types and interfaces
 */

export interface CoreSignalApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    count?: number;
    page?: number;
    limit?: number;
  };
  error?: {
    message: string;
    code: string;
  };
}

export interface CoreSignalError {
  message: string;
  code: string;
  statusCode: number;
}

export interface EmployeeSearchQuery {
  company_name?: string;
  company_domain?: string;
  job_title?: string;
  location?: string;
  skills?: string[];
  experience_level?: 'junior' | 'mid' | 'senior' | 'executive';
  limit?: number;
  offset?: number;
  keywords?: string;
}

export interface CompanySearchQuery {
  name?: string;
  domain?: string;
  industry?: string;
  location?: string;
  size?: string;
  limit?: number;
  offset?: number;
}

export interface CoreSignalRequestOptions {
  useCache?: boolean;
  cacheTtl?: number;
}
