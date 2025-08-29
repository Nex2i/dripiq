import { Employee, EmployeeSearchResponse, CompanyWithEmployees } from '../types';

export const mockEmployee: Employee = {
  id: 'emp_123',
  first_name: 'John',
  last_name: 'Doe',
  full_name: 'John Doe',
  email: 'john.doe@example.com',
  job_title: 'Senior Software Engineer',
  job_department: 'Engineering',
  job_level: 'Senior',
  company_id: 'comp_456',
  company_name: 'TechCorp Inc.',
  company_domain: 'techcorp.com',
  company_industry: 'Technology',
  location: {
    country: 'United States',
    region: 'California',
    city: 'San Francisco',
  },
  linkedin_url: 'https://linkedin.com/in/johndoe',
  skills: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
  experience: [
    {
      company_name: 'TechCorp Inc.',
      job_title: 'Senior Software Engineer',
      start_date: '2021-01-01',
      duration: '3+ years',
      description: 'Full-stack development',
      location: 'San Francisco, CA',
    },
    {
      company_name: 'StartupXYZ',
      job_title: 'Software Engineer',
      start_date: '2019-06-01',
      end_date: '2020-12-31',
      duration: '1.5 years',
      description: 'Frontend development',
      location: 'San Francisco, CA',
    },
  ],
  education: [
    {
      institution: 'Stanford University',
      degree: 'Bachelor of Science',
      field_of_study: 'Computer Science',
      start_date: '2015-09-01',
      end_date: '2019-06-01',
    },
  ],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-15T12:00:00Z',
};

export const mockEmployeeSearchResponse: EmployeeSearchResponse = {
  employees: [mockEmployee],
  total_count: 1,
  page: 1,
  limit: 50,
};

export const mockCompanyWithEmployees: CompanyWithEmployees = {
  company: {
    id: 'comp_456',
    name: 'TechCorp Inc.',
    domain: 'techcorp.com',
    industry: 'Technology',
  },
  employees: {
    current: [mockEmployee],
    former: [],
    total_current: 1,
    total_former: 0,
  },
};
