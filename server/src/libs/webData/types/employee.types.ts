/**
 * Employee data types from CoreSignal API
 *
 * NOTE: These interfaces are based on industry standards and common patterns
 * from professional data APIs. Before production use, validate these schemas
 * against actual CoreSignal API responses using their free testing credits:
 * https://dashboard.coresignal.com/sign-up
 *
 * For official field definitions, see:
 * https://docs.coresignal.com/api/employee
 */

export interface Employee {
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
  experience?: ExperienceEntry[];
  education?: EducationEntry[];
  created_at?: string;
  updated_at?: string;
}

export interface ExperienceEntry {
  company_name?: string;
  job_title?: string;
  start_date?: string;
  end_date?: string;
  duration?: string;
  description?: string;
  location?: string;
}

export interface EducationEntry {
  institution?: string;
  degree?: string;
  field_of_study?: string;
  start_date?: string;
  end_date?: string;
  description?: string;
}

export interface EmployeeSearchResponse {
  employees: Employee[];
  total_count: number;
  page: number;
  limit: number;
}

export interface CompanyEmployee {
  employee: Employee;
  company_association: {
    start_date?: string;
    end_date?: string;
    is_current: boolean;
    department?: string;
    level?: string;
  };
}
