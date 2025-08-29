# CoreSignal API Client

A comprehensive TypeScript client for the CoreSignal API that provides access to employee and company data with built-in caching, error handling, and logging.

## Features

- **Employee Search**: Search for employees by company, job title, location, and more
- **Company Search**: Find companies by name, domain, industry, and location
- **Company Employees**: Get all employees (current and former) for a specific company
- **Caching**: Redis-based caching with configurable TTL to reduce API calls
- **Error Handling**: Comprehensive error handling with typed errors
- **Logging**: Integrated with the application's Pino logger
- **TypeScript**: Full TypeScript support with comprehensive type definitions

## Setup

### Environment Configuration

Add your CoreSignal API key to your `.env` file:

```env
CORESIGNAL_API_KEY=your_coresignal_api_key_here
```

### Usage

#### Basic Usage

```typescript
import { getCoreSignalClient } from '@/libs/webData';

const client = getCoreSignalClient();
```

#### Singleton Pattern

The client uses a singleton pattern to ensure only one instance is created:

```typescript
import { getCoreSignalClient } from '@/libs/webData';

// This will always return the same instance
const client1 = getCoreSignalClient();
const client2 = getCoreSignalClient();
console.log(client1 === client2); // true
```

## API Methods

### Employee Search

Search for employees based on various criteria:

```typescript
const employees = await client.searchEmployees({
  company_name: 'TechCorp Inc',
  job_title: 'Software Engineer',
  location: 'San Francisco',
  limit: 50,
  offset: 0
});

console.log(employees.employees); // Array of Employee objects
console.log(employees.total_count); // Total number of results
```

### Get Employee by ID

Retrieve a specific employee by their ID:

```typescript
const employee = await client.getEmployeeById('emp_123');
console.log(employee.full_name);
console.log(employee.job_title);
console.log(employee.company_name);
```

### Company Employees

Get all employees for a specific company:

```typescript
// By company domain
const companyData = await client.getEmployeesByCompany('techcorp.com');
console.log(companyData.employees.current); // Current employees
console.log(companyData.employees.former);  // Former employees

// Include past employees
const withPast = await client.getEmployeesByCompany('techcorp.com', {
  includePastEmployees: true
});
```

### Company Search

Search for companies:

```typescript
const companies = await client.searchCompanies({
  name: 'TechCorp',
  industry: 'Technology',
  location: 'San Francisco',
  limit: 10
});

console.log(companies.companies); // Array of Company objects
```

### Get Company by ID or Domain

```typescript
// By ID
const company = await client.getCompanyById('comp_456');

// By domain
const company = await client.getCompanyByDomain('techcorp.com');
```

### Complete Company Data

Get comprehensive company information including all employees:

```typescript
const fullData = await client.getCompanyWithAllEmployees('techcorp.com');
console.log(fullData.company);   // Company information
console.log(fullData.employees); // All employees data
```

## Caching

The client includes built-in Redis caching to improve performance and reduce API calls.

### Cache Configuration

```typescript
// Use default caching (1 hour TTL)
const employees = await client.searchEmployees({ company_name: 'TechCorp' });

// Disable caching for this request
const employees = await client.searchEmployees(
  { company_name: 'TechCorp' },
  { useCache: false }
);

// Custom cache TTL (30 minutes)
const employees = await client.searchEmployees(
  { company_name: 'TechCorp' },
  { cacheTtl: 1800 }
);
```

### Cache Management

```typescript
// Clear cache (when implemented)
await client.clearCache();

// Get cache statistics (when implemented)
const stats = await client.getCacheStats();
```

## Error Handling

The client provides comprehensive error handling:

```typescript
try {
  const employee = await client.getEmployeeById('invalid_id');
} catch (error) {
  if (error.statusCode === 404) {
    console.log('Employee not found');
  } else if (error.statusCode === 401) {
    console.log('Invalid API key');
  } else {
    console.log('API error:', error.message);
  }
}
```

## Type Definitions

### Employee

```typescript
interface Employee {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  email?: string;
  job_title?: string;
  job_department?: string;
  company_name?: string;
  company_domain?: string;
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
  skills?: string[];
  experience?: ExperienceEntry[];
  education?: EducationEntry[];
  // ... more fields
}
```

### Company

```typescript
interface Company {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  employee_count?: number;
  location?: {
    headquarters?: {
      country?: string;
      city?: string;
    };
  };
  // ... more fields
}
```

## Advanced Usage

### Custom Client Instance

If you need a custom client instance (e.g., for testing):

```typescript
import { CoreSignalClient } from '@/libs/webData';

const customClient = new CoreSignalClient();
```

### Testing

For testing, you can reset the singleton instance:

```typescript
import { resetCoreSignalClient } from '@/libs/webData';

afterEach(() => {
  resetCoreSignalClient();
});
```

## Rate Limiting

The CoreSignal API has rate limits. The client doesn't implement built-in rate limiting, so ensure your usage stays within the API limits. Consider:

- Using caching to reduce API calls
- Implementing exponential backoff for retries
- Monitoring your API usage

## Logging

All API requests and responses are logged using the application's Pino logger:

```typescript
// Logs include:
// - Request method, URL, and parameters
// - Response status and data size
// - Cache hits/misses
// - Error details
```

## Best Practices

1. **Use caching**: Enable caching for repeated requests to improve performance
2. **Handle errors**: Always wrap API calls in try-catch blocks
3. **Batch requests**: When possible, use company-level endpoints to get multiple employees at once
4. **Monitor usage**: Keep track of your API usage to stay within limits
5. **Use specific queries**: More specific search criteria return more relevant results

## Examples

### Find Software Engineers at a Company

```typescript
const engineers = await client.searchEmployees({
  company_name: 'TechCorp Inc',
  job_title: 'Software Engineer',
  limit: 100
});

console.log(`Found ${engineers.total_count} software engineers at TechCorp`);
```

### Get All Employees for Analysis

```typescript
const companyData = await client.getCompanyWithAllEmployees('techcorp.com', {
  includePastEmployees: true
});

const allEmployees = [
  ...companyData.employees.current,
  ...companyData.employees.former
];

console.log(`Total employees analyzed: ${allEmployees.length}`);
```

### Search for Companies in a Specific Industry

```typescript
const techCompanies = await client.searchCompanies({
  industry: 'Technology',
  location: 'San Francisco',
  size: '100-500',
  limit: 50
});

for (const company of techCompanies.companies) {
  console.log(`${company.name} - ${company.employee_count} employees`);
}
```