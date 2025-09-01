/**
 * CoreSignal API v2 Multi-Source types and interfaces
 */

export interface CoreSignalError {
  message: string;
  code: string;
  statusCode: number;
}

// Multi-source employee search query structure
export interface CoreSignalEmployeeSearchQuery {
  query: {
    bool: {
      must: Array<{
        term?: {
          is_decision_maker?: number;
        };
        nested?: {
          path: string;
          query: {
            match_phrase: {
              [key: string]: string;
            };
          };
        };
      }>;
    };
  };
}

// Multi-source employee search response (array of IDs)
export type CoreSignalEmployeeSearchResponse = number[];

// Multi-source employee collection response (full employee data)
export interface CoreSignalEmployeeCollectionResponse {
  id: number;
  parent_id: number;
  created_at: string;
  updated_at: string;
  checked_at: string;
  changed_at: string;
  experience_change_last_identified_at: string | null;
  is_deleted: number;
  is_parent: number;
  public_profile_id: number;
  linkedin_url: string;
  linkedin_shorthand_names: string[];
  historical_ids: number[];
  full_name: string;
  first_name: string;
  first_name_initial: string;
  middle_name: string | null;
  middle_name_initial: string | null;
  last_name: string;
  last_name_initial: string;
  headline: string;
  summary: string;
  picture_url: string;
  location_country: string;
  location_country_iso2: string;
  location_country_iso3: string;
  location_full: string;
  location_regions: string[];
  interests: string[];
  inferred_skills: string[];
  historical_skills: string[];
  connections_count: number;
  followers_count: number;
  services: any;
  primary_professional_email: string;
  primary_professional_email_status: string;
  professional_emails_collection: Array<{
    professional_email: string;
    professional_email_status: string;
    order_of_priority: number;
  }>;
  is_working: number;
  active_experience_company_id: number;
  active_experience_title: string;
  active_experience_description: string;
  active_experience_department: string;
  active_experience_management_level: string;
  is_decision_maker: number;
  total_experience_duration_months: number;
  total_experience_duration_months_breakdown_department: Array<{
    department: string;
    total_experience_duration_months: number;
  }>;
  total_experience_duration_months_breakdown_management_level: Array<{
    management_level: string;
    total_experience_duration_months: number;
  }>;
  experience: Array<{
    active_experience: number;
    position_title: string;
    department: string;
    management_level: string;
    location: string;
    description: string;
    date_from: string;
    date_from_year: number;
    date_from_month: number | null;
    date_to: string | null;
    date_to_year: number | null;
    date_to_month: number | null;
    duration_months: number;
    company_id: number;
    company_name: string;
    company_type: string;
    company_founded_year: number | null;
    company_followers_count: number;
    company_website: string;
    company_facebook_url: string[];
    company_twitter_url: string[];
    company_linkedin_url: string;
    company_size_range: string;
    company_employees_count: number;
    company_industry: string;
    company_categories_and_keywords: string[];
    company_annual_revenue_source_5: number | null;
    company_annual_revenue_currency_source_5: string | null;
    company_annual_revenue_source_1: number | null;
    company_annual_revenue_currency_source_1: string | null;
    company_employees_count_change_yearly_percentage: number;
    company_last_funding_round_date: string | null;
    company_last_funding_round_amount_raised: number | null;
    company_hq_full_address: string;
    company_hq_country: string;
    company_hq_regions: string[];
    company_hq_country_iso2: string;
    company_hq_country_iso3: string;
    company_hq_city: string;
    company_hq_state: string;
    company_hq_street: string;
    company_hq_zipcode: string;
    company_last_updated_at: string;
    company_stock_ticker: string[];
    company_is_b2b: number;
    order_in_profile: number;
  }>;
  projected_base_salary_p25: number | null;
  projected_base_salary_median: number | null;
  projected_base_salary_p75: number | null;
  projected_base_salary_period: string | null;
  projected_base_salary_currency: string | null;
  projected_base_salary_updated_at: string | null;
  projected_additional_salary: any[];
  projected_additional_salary_period: string | null;
  projected_additional_salary_currency: string | null;
  projected_additional_salary_updated_at: string | null;
  projected_total_salary_p25: number | null;
  projected_total_salary_median: number | null;
  projected_total_salary_p75: number | null;
  projected_total_salary_period: string | null;
  projected_total_salary_currency: string | null;
  projected_total_salary_updated_at: string | null;
  last_graduation_date: number;
  education_degrees: string[];
  education: Array<{
    degree: string;
    description: string | null;
    institution_url: string;
    institution_name: string;
    institution_full_address: string;
    institution_country_iso2: string;
    institution_country_iso3: string;
    institution_regions: string[];
    institution_city: string;
    institution_state: string;
    institution_street: string;
    institution_zipcode: string;
    date_from_year: number;
    date_to_year: number;
    activities_and_societies: string | null;
    order_in_profile: number;
  }>;
  recommendations_count: number;
  recommendations: Array<{
    recommendation: string;
    referee_full_name: string;
    referee_url: string;
    order_in_profile: number;
  }>;
  activity: Array<{
    activity_url: string;
    title: string;
    action: string;
    order_in_profile: number;
  }>;
  awards: Array<{
    title: string;
    issuer: string | null;
    description: string;
    date: string;
    date_year: number;
    date_month: number;
    order_in_profile: number;
  }>;
  courses: any[];
  certifications: any[];
  languages: any[];
  patents_count: number | null;
  patents_topics: any[];
  patents: any[];
  publications_count: number | null;
  publications_topics: any[];
  publications: any[];
  projects_count: number | null;
  projects_topics: any[];
  projects: any[];
  organizations: any[];
  github_url: string | null;
  github_username: string | null;
  github_mapping_confidence: number | null;
  github_contributions_count: number | null;
  github_repos_summary: any[];
  profile_root_field_changes_summary: Array<{
    field_name: string;
    change_type: string;
    last_changed_at: string;
  }>;
  profile_collection_field_changes_summary: Array<{
    field_name: string;
    last_changed_at: string;
  }>;
  experience_recently_started: any[];
  experience_recently_closed: any[];
}

export interface CoreSignalRequestOptions {
  useCache?: boolean;
  cacheTtl?: number;
  limit?: number;
  isDecisionMaker?: boolean;
}
