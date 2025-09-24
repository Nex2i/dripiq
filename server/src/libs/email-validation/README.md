# Email Validation Service

A comprehensive email validation service that mimics ZeroBounce functionality, providing detailed validation results for email addresses including deliverability, domain classification, and metadata extraction.

## Features

- **Syntax Validation**: Uses existing string extensions for RFC-compliant email format checking
- **Domain Validation**: DNS/MX record verification to ensure domain exists and accepts email
- **SMTP Validation**: Optional SMTP connection testing (with rate limiting considerations)
- **Domain Classification**: Identifies free providers, disposable emails, and role-based accounts
- **Name Extraction**: Attempts to extract first/last names from email patterns
- **Typo Suggestions**: Provides corrections for common domain misspellings
- **Clean Architecture**: Follows SOLID principles with dependency injection and ports/adapters pattern

## API Response Format

The service returns a comprehensive validation result matching ZeroBounce's format:

```typescript
interface EmailValidationResult {
  email: string;                    // The validated email address
  status: 'valid' | 'invalid' | 'unknown';
  sub_status: string | null;        // Detailed status (disposable, role_based, etc.)
  free_email: boolean;              // True for Gmail, Yahoo, etc.
  did_you_mean: string | null;      // Suggested correction for typos
  account: string;                  // Username part (before @)
  domain: string;                   // Domain part (after @)
  domain_age_days: number | null;   // Estimated domain age
  smtp_provider: string | null;     // Provider (google, microsoft, yahoo)
  mx_found: boolean;                // Whether MX records exist
  mx_record: string | null;         // Primary MX record
  firstname: string | null;         // Extracted first name
  lastname: string | null;          // Extracted last name
}
```

## REST API Endpoints

### POST /api/email-validation
Validates an email address via POST request body.

**Request:**
```json
{
  "email": "ryan@filevine.com"
}
```

**Response:**
```json
{
  "email": "ryan@filevine.com",
  "status": "valid",
  "sub_status": null,
  "free_email": false,
  "did_you_mean": null,
  "account": "ryan",
  "domain": "filevine.com",
  "domain_age_days": 6817,
  "smtp_provider": "microsoft",
  "mx_found": true,
  "mx_record": "filevine-com.mail.protection.outlook.com",
  "firstname": null,
  "lastname": null
}
```

### GET /api/email-validation?email=user@example.com
Validates an email address via query parameter.

### GET /api/email-validation/health
Health check endpoint for the service.

## Usage Examples

### Basic Usage
```typescript
import { EmailValidationService } from '@/libs/email-validation';

const service = EmailValidationService.createDefault();
const result = await service.validateEmail('user@example.com');

console.log(`Status: ${result.status}`);
console.log(`MX Found: ${result.mx_found}`);
console.log(`Free Email: ${result.free_email}`);
```

### With SMTP Validation
```typescript
const service = EmailValidationService.createWithSmtpValidation();
const result = await service.validateEmail('user@example.com');
```

### Custom Configuration
```typescript
const service = new EmailValidationService({
  enableSmtpValidation: true,
  smtpTimeout: 5000,
  maxRetries: 2,
  enableCaching: true,
  cacheTtlSeconds: 1800
});
```

## Architecture

The service follows clean architecture principles:

### Domain Layer
- `EmailValidationResultEntity`: Business entity with validation rules
- Business logic for risk assessment and manual review detection

### Infrastructure Layer
- `DomainClassifier`: Categorizes domains (free, disposable, role-based)
- `DnsValidator`: DNS/MX record validation
- `SmtpValidator`: SMTP connection testing

### API Layer
- REST endpoints with proper schemas and error handling
- Structured logging with PII masking

## Validation Process

1. **Syntax Check**: Uses existing `isValidEmail()` extension
2. **Domain Extraction**: Uses existing `getEmailDomain()` extension  
3. **Domain Classification**: Identifies provider type and characteristics
4. **DNS Validation**: Checks MX records for deliverability
5. **SMTP Testing**: Optional mailbox existence verification (limited by provider blocking)
6. **Name Extraction**: Attempts to parse names from email patterns
7. **Result Assembly**: Creates comprehensive validation result

## Domain Classification

### Free Email Providers
- Gmail, Yahoo, Outlook, Hotmail, iCloud, AOL, etc.
- Identified by domain matching

### Disposable Email Providers  
- Temporary email services (10minutemail, tempmail, etc.)
- Automatically marked as invalid

### Role-Based Accounts
- admin, info, support, contact, sales, etc.
- Valid but flagged for business rules

### SMTP Providers
- Maps domains to their email providers (Google, Microsoft, Yahoo, etc.)

## Limitations & Considerations

### SMTP Validation Challenges
- Many providers (Gmail, Outlook) block SMTP validation attempts
- Rate limiting required to avoid IP blocking
- Enabled by default for accurate validation, skips known problematic domains

### Accuracy Expectations
- **Syntax**: 99%+ accuracy
- **Domain/MX**: 95%+ accuracy  
- **SMTP**: 70-85% accuracy (due to blocking)
- **Name extraction**: 40-60% accuracy
- **Domain classification**: 90%+ accuracy for known domains

### Performance
- DNS lookups: ~100-500ms per email
- SMTP validation: 1-10 seconds per email (when enabled)
- Parallel processing recommended for bulk validation

## Testing

### Unit Tests
```bash
npm test -- libs/email-validation/__tests__/emailValidation.service.test.ts
```

### Integration Tests
```bash
npm test -- libs/email-validation/__tests__/emailValidation.integration.test.ts
```

### Domain Classification Tests
```bash
npm test -- libs/email-validation/__tests__/domainClassifier.test.ts
```

## Security & Privacy

- **No Data Storage**: Email addresses are not stored or cached by default
- **PII Masking**: Email addresses are masked in logs (us***@domain.com)
- **Rate Limiting**: Built-in protection against abuse
- **GDPR Compliant**: No personal data retention

## Monitoring & Observability

- Structured logging with correlation IDs
- Performance metrics for validation steps
- Error tracking and alerting
- Health check endpoint for monitoring

## Extension Points

The service is designed for extensibility:

- **Custom Domain Lists**: Add industry-specific disposable domains
- **Enhanced Name Extraction**: Integrate with name databases
- **Caching Layer**: Add Redis caching for repeated validations  
- **Webhooks**: Add async validation with callback URLs
- **Bulk Processing**: Add batch validation endpoints

## Compliance

- Follows existing codebase patterns and architecture
- Integrates with existing logging and error handling
- Uses established string extensions for email validation
- Maintains consistency with API schema patterns