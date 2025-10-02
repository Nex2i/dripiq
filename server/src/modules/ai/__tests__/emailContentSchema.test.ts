import { logger } from '@/libs/logger';
import {
  emailContentSchema,
  emailContentOutputSchema,
  validateEmailContentIds,
  filterAndLogInvalidEmailIds,
  createDefaultEmailContent,
  EXAMPLE_EMAIL_CONTENT_OUTPUT,
  type EmailContent,
  type EmailContentOutput,
} from '../schemas/contactStrategy/emailContentSchema';

// Mock the logger to capture log calls
jest.mock('@/libs/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

const mockedLogger = logger as jest.Mocked<typeof logger>;

describe('emailContentSchema', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('emailContentSchema validation', () => {
    test('validates valid email content', () => {
      const validEmail: EmailContent = {
        id: 'email_intro',
        subject: 'Test Subject',
        body: 'Test email body content',
      };

      const result = emailContentSchema.safeParse(validEmail);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validEmail);
      }
    });

    test('rejects email with empty id', () => {
      const invalidEmail = {
        id: '',
        subject: 'Test Subject',
        body: 'Test email body content',
      };

      const result = emailContentSchema.safeParse(invalidEmail);
      expect(result.success).toBe(false);
    });

    test('rejects email with empty subject', () => {
      const invalidEmail = {
        id: 'email_intro',
        subject: '',
        body: 'Test email body content',
      };

      const result = emailContentSchema.safeParse(invalidEmail);
      expect(result.success).toBe(false);
    });

    test('rejects email with empty body', () => {
      const invalidEmail = {
        id: 'email_intro',
        subject: 'Test Subject',
        body: '',
      };

      const result = emailContentSchema.safeParse(invalidEmail);
      expect(result.success).toBe(false);
    });

    test('rejects email with missing fields', () => {
      const invalidEmail = {
        id: 'email_intro',
        subject: 'Test Subject',
        // missing body
      };

      const result = emailContentSchema.safeParse(invalidEmail);
      expect(result.success).toBe(false);
    });
  });

  describe('emailContentOutputSchema validation', () => {
    test('validates valid email content output', () => {
      const validOutput: EmailContentOutput = {
        emails: [
          {
            id: 'email_intro',
            subject: 'Test Subject 1',
            body: 'Test email body 1',
          },
          {
            id: 'email_followup_1',
            subject: 'Test Subject 2',
            body: 'Test email body 2',
          },
        ],
        metadata: {
          totalEmails: 2,
          personalizationLevel: 'high',
          primaryValueProposition: 'Test value prop',
        },
      };

      const result = emailContentOutputSchema.safeParse(validOutput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validOutput);
      }
    });

    test('rejects output with empty emails array', () => {
      const invalidOutput = {
        emails: [],
        metadata: {
          totalEmails: 0,
          personalizationLevel: 'high',
          primaryValueProposition: 'Test value prop',
        },
      };

      const result = emailContentOutputSchema.safeParse(invalidOutput);
      expect(result.success).toBe(false);
    });

    test('rejects output with invalid metadata', () => {
      const invalidOutput = {
        emails: [
          {
            id: 'email_intro',
            subject: 'Test Subject',
            body: 'Test email body',
          },
        ],
        metadata: {
          totalEmails: -1, // invalid
          personalizationLevel: 'invalid_level', // invalid
          primaryValueProposition: '',
        },
      };

      const result = emailContentOutputSchema.safeParse(invalidOutput);
      expect(result.success).toBe(false);
    });
  });

  describe('validateEmailContentIds', () => {
    const validEmailIds = ['email_intro', 'email_followup_1', 'email_value_add_1'];

    test('validates when all email IDs are valid', () => {
      const emailContent: EmailContentOutput = {
        emails: [
          { id: 'email_intro', subject: 'Test 1', body: 'Body 1' },
          { id: 'email_followup_1', subject: 'Test 2', body: 'Body 2' },
        ],
        metadata: {
          totalEmails: 2,
          personalizationLevel: 'high',
          primaryValueProposition: 'Test',
        },
      };

      const result = validateEmailContentIds(emailContent, validEmailIds);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('detects invalid email IDs', () => {
      const emailContent: EmailContentOutput = {
        emails: [
          { id: 'email_intro', subject: 'Test 1', body: 'Body 1' },
          { id: 'email_invalid', subject: 'Test 2', body: 'Body 2' },
          { id: 'email_followup_2', subject: 'Test 3', body: 'Body 3' },
        ],
        metadata: {
          totalEmails: 3,
          personalizationLevel: 'high',
          primaryValueProposition: 'Test',
        },
      };

      const result = validateEmailContentIds(emailContent, validEmailIds);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Invalid email IDs (not in template): email_invalid, email_followup_2'
      );
    });

    test('detects duplicate email IDs', () => {
      const emailContent: EmailContentOutput = {
        emails: [
          { id: 'email_intro', subject: 'Test 1', body: 'Body 1' },
          { id: 'email_intro', subject: 'Test 2', body: 'Body 2' },
        ],
        metadata: {
          totalEmails: 2,
          personalizationLevel: 'high',
          primaryValueProposition: 'Test',
        },
      };

      const result = validateEmailContentIds(emailContent, validEmailIds);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Duplicate email IDs found: email_intro');
    });

    test('warns about missing IDs (but still valid)', () => {
      const emailContent: EmailContentOutput = {
        emails: [{ id: 'email_intro', subject: 'Test 1', body: 'Body 1' }],
        metadata: {
          totalEmails: 1,
          personalizationLevel: 'high',
          primaryValueProposition: 'Test',
        },
      };

      // Capture console.warn
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = validateEmailContentIds(emailContent, validEmailIds);
      expect(result.isValid).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Missing email content for template IDs: email_followup_1, email_value_add_1'
      );

      consoleSpy.mockRestore();
    });

    test('handles both invalid and duplicate IDs', () => {
      const emailContent: EmailContentOutput = {
        emails: [
          { id: 'email_intro', subject: 'Test 1', body: 'Body 1' },
          { id: 'email_intro', subject: 'Test 2', body: 'Body 2' },
          { id: 'email_invalid', subject: 'Test 3', body: 'Body 3' },
        ],
        metadata: {
          totalEmails: 3,
          personalizationLevel: 'high',
          primaryValueProposition: 'Test',
        },
      };

      const result = validateEmailContentIds(emailContent, validEmailIds);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContain('Duplicate email IDs found: email_intro');
      expect(result.errors).toContain('Invalid email IDs (not in template): email_invalid');
    });
  });

  describe('filterAndLogInvalidEmailIds', () => {
    const validEmailIds = ['email_intro', 'email_followup_1', 'email_value_add_1'];

    test('returns original content when all IDs are valid', () => {
      const emailContent: EmailContentOutput = {
        emails: [
          { id: 'email_intro', subject: 'Test 1', body: 'Body 1' },
          { id: 'email_followup_1', subject: 'Test 2', body: 'Body 2' },
        ],
        metadata: {
          totalEmails: 2,
          personalizationLevel: 'high',
          primaryValueProposition: 'Test',
        },
      };

      const result = filterAndLogInvalidEmailIds(emailContent, validEmailIds);
      expect(result).toEqual(emailContent);
      expect(mockedLogger.error).not.toHaveBeenCalled();
    });

    test('filters out invalid IDs and logs error', () => {
      const emailContent: EmailContentOutput = {
        emails: [
          { id: 'email_intro', subject: 'Test 1', body: 'Body 1' },
          { id: 'email_invalid', subject: 'Test 2', body: 'Body 2' },
          { id: 'email_followup_2', subject: 'Test 3', body: 'Body 3' },
          { id: 'email_followup_1', subject: 'Test 4', body: 'Body 4' },
        ],
        metadata: {
          totalEmails: 4,
          personalizationLevel: 'high',
          primaryValueProposition: 'Test',
        },
      };

      const result = filterAndLogInvalidEmailIds(emailContent, validEmailIds);

      // Should only keep valid emails
      expect(result.emails).toHaveLength(2);
      expect(result.emails[0]?.id).toBe('email_intro');
      expect(result.emails[1]?.id).toBe('email_followup_1');

      // Should update metadata
      expect(result.metadata?.totalEmails).toBe(2);
      expect(result.metadata?.personalizationLevel).toBe('high');
      expect(result.metadata?.primaryValueProposition).toBe('Test');

      // Should log error with details
      expect(mockedLogger.error).toHaveBeenCalledWith(
        'AI generated invalid email IDs - filtering them out',
        {
          invalidIds: ['email_invalid', 'email_followup_2'],
          validIds: ['email_intro', 'email_followup_1'],
          expectedIds: validEmailIds,
          totalOriginal: 4,
          totalFiltered: 2,
          removedCount: 2,
        }
      );
    });

    test('logs additional error when all emails are invalid', () => {
      const emailContent: EmailContentOutput = {
        emails: [
          { id: 'email_invalid_1', subject: 'Test 1', body: 'Body 1' },
          { id: 'email_invalid_2', subject: 'Test 2', body: 'Body 2' },
        ],
        metadata: {
          totalEmails: 2,
          personalizationLevel: 'high',
          primaryValueProposition: 'Test',
        },
      };

      const result = filterAndLogInvalidEmailIds(emailContent, validEmailIds);

      // Should have no emails left
      expect(result.emails).toHaveLength(0);
      expect(result.metadata?.totalEmails).toBe(0);

      // Should log both the filtering error and the "all invalid" error
      expect(mockedLogger.error).toHaveBeenCalledTimes(2);

      expect(mockedLogger.error).toHaveBeenNthCalledWith(
        1,
        'AI generated invalid email IDs - filtering them out',
        expect.objectContaining({
          invalidIds: ['email_invalid_1', 'email_invalid_2'],
          validIds: [],
          removedCount: 2,
        })
      );

      expect(mockedLogger.error).toHaveBeenNthCalledWith(
        2,
        'All AI-generated emails were invalid - no valid content remaining',
        {
          originalIds: ['email_invalid_1', 'email_invalid_2'],
          expectedIds: validEmailIds,
        }
      );
    });

    test('handles mixed valid and invalid IDs correctly', () => {
      const emailContent: EmailContentOutput = {
        emails: [
          { id: 'email_intro', subject: 'Valid 1', body: 'Body 1' },
          { id: 'email_value_add', subject: 'Invalid 1', body: 'Body 2' }, // Invalid (missing _1)
          { id: 'email_value_add_1', subject: 'Valid 2', body: 'Body 3' },
          { id: 'email_use_case', subject: 'Invalid 2', body: 'Body 4' }, // Invalid
        ],
        metadata: {
          totalEmails: 4,
          personalizationLevel: 'medium',
          primaryValueProposition: 'Test prop',
        },
      };

      const result = filterAndLogInvalidEmailIds(emailContent, validEmailIds);

      expect(result.emails).toHaveLength(2);
      expect(result.emails.map((e) => e.id)).toEqual(['email_intro', 'email_value_add_1']);
      expect(result.metadata?.totalEmails).toBe(2);

      expect(mockedLogger.error).toHaveBeenCalledWith(
        'AI generated invalid email IDs - filtering them out',
        expect.objectContaining({
          invalidIds: ['email_value_add', 'email_use_case'],
          validIds: ['email_intro', 'email_value_add_1'],
          removedCount: 2,
        })
      );
    });

    test('preserves original metadata properties except totalEmails', () => {
      const emailContent: EmailContentOutput = {
        emails: [
          { id: 'email_intro', subject: 'Test 1', body: 'Body 1' },
          { id: 'email_invalid', subject: 'Test 2', body: 'Body 2' },
        ],
        metadata: {
          totalEmails: 2,
          personalizationLevel: 'low',
          primaryValueProposition: 'Custom value proposition',
        },
      };

      const result = filterAndLogInvalidEmailIds(emailContent, validEmailIds);

      expect(result.metadata?.personalizationLevel).toBe('low');
      expect(result.metadata?.primaryValueProposition).toBe('Custom value proposition');
      expect(result.metadata?.totalEmails).toBe(1); // Updated count
    });
  });

  describe('createDefaultEmailContent', () => {
    test('creates default email content with provided ID', () => {
      const result = createDefaultEmailContent('email_test');

      expect(result).toHaveProperty('id', 'email_test');
      expect(result).toHaveProperty('subject', 'Follow-up');
      expect(result).toHaveProperty('body');
      expect(result.body).toContain('Thank you for your time');
    });

    test('creates email content with custom subject and body', () => {
      const result = createDefaultEmailContent(
        'email_custom',
        'Custom Subject',
        'Custom body content'
      );

      expect(result.id).toBe('email_custom');
      expect(result.subject).toBe('Custom Subject');
      expect(result.body).toBe('Custom body content');
    });

    test('created email passes individual email schema validation', () => {
      const result = createDefaultEmailContent('email_test');
      const validation = emailContentSchema.safeParse(result);
      expect(validation.success).toBe(true);
    });
  });

  describe('EXAMPLE_EMAIL_CONTENT_OUTPUT', () => {
    test('example data has valid structure', () => {
      expect(EXAMPLE_EMAIL_CONTENT_OUTPUT).toHaveProperty('emails');
      expect(EXAMPLE_EMAIL_CONTENT_OUTPUT).toHaveProperty('metadata');
      expect(Array.isArray(EXAMPLE_EMAIL_CONTENT_OUTPUT.emails)).toBe(true);
      expect(EXAMPLE_EMAIL_CONTENT_OUTPUT.emails.length).toBeGreaterThan(0);
    });

    test('example data passes schema validation', () => {
      const result = emailContentOutputSchema.safeParse(EXAMPLE_EMAIL_CONTENT_OUTPUT);
      expect(result.success).toBe(true);
    });
  });
});
