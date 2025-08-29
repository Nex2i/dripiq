# WebData Service - Provider Abstraction Layer

The WebData Service provides a unified interface for employee and company data retrieval from multiple providers. This abstraction layer allows you to easily swap between different data providers without changing your application code.

## Features

- **Provider Abstraction**: Unified interface that works with any data provider
- **Easy Provider Switching**: Change providers with a single method call
- **Multiple Providers**: Currently supports CoreSignal with easy extension for others
- **Consistent API**: Same method signatures regardless of underlying provider
- **Provider Health Monitoring**: Built-in health checking and monitoring
- **Comprehensive Logging**: Detailed logging for all operations
- **Error Handling**: Standardized error handling across all providers

## Quick Start

### Basic Usage (Recommended)

```typescript
import { getWebDataService } from '@/libs/webData';

const webData = getWebDataService();

// Get all employees for a company (your primary use case)
const companyData = await webData.getCompanyWithAllEmployees('techcorp.com');
console.log(companyData.company);        // Company information
console.log(companyData.employees);      // All employee data
console.log(companyData.provider);       // "CoreSignal"
```

### Advanced Usage

```typescript
import { WebDataService } from '@/libs/webData';

// Create service with specific provider
const webData = new WebDataService('coresignal');

// Get provider information
const info = webData.getProviderInfo();
console.log(info); // { type: 'coresignal', name: 'CoreSignal', isHealthy: true }

// Switch provider (when you add new ones)
// webData.switchProvider('apollo');
```

## Available Providers

### CoreSignal (Default)
- **Provider Type**: `'coresignal'`
- **Status**: ✅ Fully Implemented
- **Features**: Employee search, company search, comprehensive data
- **Setup**: Requires `CORESIGNAL_API_KEY` in environment

### Future Providers
- **Apollo**: `'apollo'` (planned)
- **ZoomInfo**: `'zoominfo'` (planned)
- **Custom**: `'custom'` (for your own implementations)

## API Methods

All methods return the same data structure regardless of the underlying provider:

### Employee Operations

```typescript
// Search employees
const employees = await webData.searchEmployees({
  company_name: 'TechCorp Inc',
  job_title: 'Software Engineer',
  location: 'San Francisco',
  skills: ['JavaScript', 'TypeScript']
});

// Get specific employee
const employee = await webData.getEmployeeById('emp_123');
```

### Company Operations

```typescript
// Search companies
const companies = await webData.searchCompanies({
  name: 'TechCorp',
  industry: 'Technology',
  location: 'San Francisco'
});

// Get specific company
const company = await webData.getCompanyById('comp_456');
const company = await webData.getCompanyByDomain('techcorp.com');
```

### Combined Operations

```typescript
// Get all employees for a company (recommended for your use case)
const companyData = await webData.getCompanyWithAllEmployees('techcorp.com', {
  includePastEmployees: true,
  useCache: true,
  cacheTtl: 3600
});

// Get just employees (without full company details)
const employeesData = await webData.getEmployeesByCompany('techcorp.com');
```

## Provider-Agnostic Data Types

The service uses standardized data types that work across all providers:

```typescript
interface WebDataEmployee {
  id: string;
  full_name?: string;
  job_title?: string;
  company_name?: string;
  location?: {
    country?: string;
    city?: string;
  };
  skills?: string[];
  // ... more fields
}

interface WebDataCompany {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  employee_count?: number;
  // ... more fields
}
```

## Adding New Providers

To add a new data provider:

1. **Implement the Interface**:
```typescript
import { IWebDataProvider } from '@/libs/webData';

class ApolloWebDataProvider implements IWebDataProvider {
  readonly providerName = 'Apollo';
  readonly isHealthy = true;

  async searchEmployees(filters, options) {
    // Implementation
  }
  
  // ... implement all other methods
}
```

2. **Register in Service**:
```typescript
// In webData.service.ts
case 'apollo':
  return new ApolloWebDataProvider();
```

3. **Use the New Provider**:
```typescript
const webData = new WebDataService('apollo');
```

## Error Handling

All providers return standardized errors:

```typescript
try {
  const employee = await webData.getEmployeeById('invalid_id');
} catch (error) {
  console.log(error.provider);    // "CoreSignal"
  console.log(error.statusCode);  // 404
  console.log(error.message);     // "Employee not found"
  console.log(error.code);        // "EMPLOYEE_NOT_FOUND"
}
```

## Caching

Caching is provider-agnostic and works consistently across all providers:

```typescript
// Use cache (default behavior)
const data = await webData.getCompanyWithAllEmployees('techcorp.com');

// Skip cache
const data = await webData.getCompanyWithAllEmployees('techcorp.com', {
  useCache: false
});

// Custom cache TTL
const data = await webData.getCompanyWithAllEmployees('techcorp.com', {
  cacheTtl: 1800 // 30 minutes
});
```

## Health Monitoring

Monitor provider health:

```typescript
// Check if provider is healthy
const isHealthy = webData.isHealthy;
console.log(isHealthy); // true/false

// Perform active health check
const healthCheckResult = await webData.healthCheck();
console.log(healthCheckResult); // true/false

// Get provider info
const info = webData.getProviderInfo();
console.log(info); // { type: 'coresignal', name: 'CoreSignal', isHealthy: true }
```

## Provider Switching Example

Here's how you would switch from CoreSignal to a hypothetical Apollo provider:

```typescript
import { getWebDataService } from '@/libs/webData';

const webData = getWebDataService(); // Starts with CoreSignal

// Your application code (doesn't change!)
const companyData = await webData.getCompanyWithAllEmployees('techcorp.com');

// Later, switch to Apollo (only this line changes)
webData.switchProvider('apollo');

// Same application code works with new provider
const companyData2 = await webData.getCompanyWithAllEmployees('techcorp.com');
console.log(companyData2.provider); // "Apollo"
```

## Singleton vs Instance Usage

### Singleton (Recommended for most cases)
```typescript
import { getWebDataService } from '@/libs/webData';

const webData = getWebDataService(); // Always returns same instance
```

### New Instance (For testing or multiple providers)
```typescript
import { WebDataService } from '@/libs/webData';

const webData = new WebDataService('coresignal');
```

## Testing

For testing, you can easily mock the service or create custom providers:

```typescript
import { resetWebDataService } from '@/libs/webData';

afterEach(() => {
  resetWebDataService(); // Reset singleton for clean tests
});

// Or create a mock provider for testing
const mockProvider: IWebDataProvider = {
  providerName: 'MockProvider',
  isHealthy: true,
  searchEmployees: jest.fn(),
  // ... mock all methods
};

const webData = new WebDataService('custom', mockProvider);
```

## Migration from Direct CoreSignal Usage

If you're currently using the CoreSignal client directly:

### Before (Direct Usage)
```typescript
import { getCoreSignalClient } from '@/libs/webData';

const client = getCoreSignalClient();
const data = await client.getCompanyWithAllEmployees('techcorp.com');
```

### After (Provider Abstraction)
```typescript
import { getWebDataService } from '@/libs/webData';

const webData = getWebDataService();
const data = await webData.getCompanyWithAllEmployees('techcorp.com');
```

The data structure remains the same, but now you have the flexibility to switch providers in the future!

## Best Practices

1. **Use the Singleton**: `getWebDataService()` for most use cases
2. **Handle Errors**: Always wrap calls in try-catch blocks
3. **Monitor Health**: Check provider health in production
4. **Use Caching**: Enable caching for better performance
5. **Log Provider Info**: Include provider info in your logs for debugging
6. **Plan for Switching**: Structure your code to easily switch providers when needed

## Environment Variables

The WebData service requires the same environment variables as the underlying providers:

```env
# For CoreSignal provider
CORESIGNAL_API_KEY=your_coresignal_api_key_here

# Future providers will add their own keys
# APOLLO_API_KEY=your_apollo_api_key_here
```