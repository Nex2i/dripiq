import { Company, CompanySearchResponse } from '../../types';

export const mockCompany: Company = {
  id: 'comp_456',
  name: 'TechCorp Inc.',
  domain: 'techcorp.com',
  website: 'https://techcorp.com',
  description: 'Leading technology company specializing in software solutions',
  industry: 'Technology',
  sub_industry: 'Software Development',
  size: '1000-5000',
  size_range: {
    min: 1000,
    max: 5000,
  },
  founded_year: 2010,
  location: {
    headquarters: {
      country: 'United States',
      region: 'California',
      city: 'San Francisco',
      address: '123 Tech Street, San Francisco, CA 94105',
    },
    locations: [
      {
        country: 'United States',
        region: 'California',
        city: 'San Francisco',
        is_headquarters: true,
      },
      {
        country: 'United States',
        region: 'New York',
        city: 'New York',
        is_headquarters: false,
      },
    ],
  },
  social_media: {
    linkedin_url: 'https://linkedin.com/company/techcorp',
    twitter_url: 'https://twitter.com/techcorp',
  },
  technologies: ['JavaScript', 'Python', 'AWS', 'Docker', 'Kubernetes'],
  revenue: {
    amount: 500000000,
    currency: 'USD',
    year: 2023,
  },
  employee_count: 2500,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-15T12:00:00Z',
};

export const mockCompanySearchResponse: CompanySearchResponse = {
  companies: [mockCompany],
  total_count: 1,
  page: 1,
  limit: 50,
};
