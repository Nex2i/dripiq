/**
 * Company data types from CoreSignal API
 *
 * NOTE: These interfaces are based on industry standards and common patterns
 * from professional data APIs. Before production use, validate these schemas
 * against actual CoreSignal API responses using their free testing credits:
 * https://dashboard.coresignal.com/sign-up
 *
 * For official field definitions, see:
 * https://docs.coresignal.com/api/company
 */

import { Employee } from './employee.types';

export interface Company {
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
    locations?: CompanyLocation[];
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

export interface CompanyLocation {
  country?: string;
  region?: string;
  city?: string;
  address?: string;
  is_headquarters?: boolean;
}

export interface CompanySearchResponse {
  companies: Company[];
  total_count: number;
  page: number;
  limit: number;
}

export interface CompanyWithEmployees {
  company: Company;
  employees: {
    current: Employee[];
    former: Employee[];
    total_current: number;
    total_former: number;
  };
}
