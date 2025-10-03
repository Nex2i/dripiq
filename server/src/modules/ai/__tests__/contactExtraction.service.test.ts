// Mock dependencies first before any imports
jest.mock('@/libs/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/libs/email/emailListVerify.client', () => ({
  emailListVerifyClient: {
    verifyEmailDetailedBatch: jest.fn(),
    mapResultToEmailVerificationResult: jest.fn(),
  },
}));

jest.mock('@/libs/phoneFormatter', () => ({
  formatPhoneForStorage: jest.fn((phone) => phone),
  normalizePhoneForComparison: jest.fn((phone) => phone?.replace(/\D/g, '')),
}));

jest.mock('@/repositories', () => ({
  leadPointOfContactRepository: {
    findByLeadId: jest.fn(),
    updateById: jest.fn(),
    updateMultipleByIdsForTenant: jest.fn(),
  },
  leadRepository: {
    updateById: jest.fn(),
  },
}));

jest.mock('../../lead.service', () => ({
  createContact: jest.fn(),
}));

// Import after mocks to prevent side effects
import { ContactExtractionService } from '../contactExtraction.service';
import { ExtractedContact } from '../schemas/contactExtraction/contactExtractionSchema';
import { NewLeadPointOfContact, LeadPointOfContact } from '@/db/schema';
import { emailListVerifyClient } from '@/libs/email/emailListVerify.client';

const mockedEmailListVerifyClient = emailListVerifyClient as jest.Mocked<
  typeof emailListVerifyClient
>;

// Mock Data Factory Functions
const createMockExtractedContact = (
  overrides: Partial<ExtractedContact> = {}
): ExtractedContact => ({
  name: 'John Doe',
  email: 'john@example.com',
  phone: null,
  title: 'CEO',
  company: null,
  contactType: 'individual',
  context: null,
  isPriorityContact: false,
  address: null,
  linkedinUrl: null,
  websiteUrl: null,
  sourceUrl: null,
  confidence: 'high',
  ...overrides,
});

const createMockLeadPointOfContact = (
  overrides: Partial<LeadPointOfContact> = {}
): LeadPointOfContact => ({
  id: '1',
  leadId: 'lead-1',
  name: 'John Doe',
  email: 'john@example.com',
  phone: null,
  title: 'CEO',
  company: null,
  sourceUrl: null,
  emailVerificationResult: 'unknown',
  manuallyReviewed: false,
  strategyStatus: 'none',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockNewLeadPointOfContact = (
  overrides: Partial<Omit<NewLeadPointOfContact, 'leadId'>> = {}
): Omit<NewLeadPointOfContact, 'leadId'> => ({
  name: 'John Doe',
  email: 'john@example.com',
  phone: null,
  title: 'CEO',
  company: null,
  sourceUrl: null,
  ...overrides,
});

describe('ContactExtractionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('deduplicateContacts', () => {
    it('should remove duplicate email contacts', () => {
      // Arrange
      const contacts: ExtractedContact[] = [
        createMockExtractedContact({ name: 'John Doe', email: 'john@example.com' }),
        createMockExtractedContact({ name: 'John Smith', email: 'JOHN@EXAMPLE.COM', title: 'CTO' }),
      ];

      // Act
      const result = ContactExtractionService.deduplicateContacts(contacts);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('John Doe');
    });

    it('should remove duplicate phone contacts', () => {
      // Arrange
      const contacts: ExtractedContact[] = [
        createMockExtractedContact({ name: 'John Doe', email: null, phone: '555-1234' }),
        createMockExtractedContact({
          name: 'Jane Doe',
          email: null,
          phone: '5551234',
          title: 'CTO',
        }),
      ];

      // Act
      const result = ContactExtractionService.deduplicateContacts(contacts);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('John Doe');
    });

    it('should remove similar name duplicates with same contact type', () => {
      // Arrange
      const contacts: ExtractedContact[] = [
        createMockExtractedContact({ name: 'John Doe', email: 'john@example.com' }),
        createMockExtractedContact({ name: 'John  Doe', email: 'johndoe@example.com' }),
      ];

      // Act
      const result = ContactExtractionService.deduplicateContacts(contacts);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('John Doe');
    });

    it('should keep contacts with different names and contact info', () => {
      // Arrange
      const contacts: ExtractedContact[] = [
        createMockExtractedContact({ name: 'John Doe', email: 'john@example.com' }),
        createMockExtractedContact({ name: 'Jane Smith', email: 'jane@example.com', title: 'CTO' }),
      ];

      // Act
      const result = ContactExtractionService.deduplicateContacts(contacts);

      // Assert
      expect(result).toHaveLength(2);
    });

    it('should filter out invalid contacts', () => {
      // Arrange
      const contacts: ExtractedContact[] = [
        createMockExtractedContact({ name: '', email: null, title: null }),
        createMockExtractedContact({ name: 'John Doe', email: 'john@example.com' }),
      ];

      // Act
      const result = ContactExtractionService.deduplicateContacts(contacts);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('John Doe');
    });
  });

  describe('validateContact', () => {
    it('should validate contact with name and email', () => {
      // Arrange
      const contact = createMockExtractedContact();

      // Act
      const result = ContactExtractionService.validateContact(contact);

      // Assert
      expect(result).toBe(true);
    });

    it('should invalidate contact without name', () => {
      // Arrange
      const contact = createMockExtractedContact({ name: '' });

      // Act
      const result = ContactExtractionService.validateContact(contact);

      // Assert
      expect(result).toBe(false);
    });

    it('should validate named individual with full name', () => {
      // Arrange
      const contact = createMockExtractedContact({
        name: 'John Doe',
        email: null,
        phone: null,
        title: null,
      });

      // Act
      const result = ContactExtractionService.validateContact(contact);

      // Assert
      expect(result).toBe(true);
    });

    it('should invalidate individual with single name and no contact info', () => {
      // Arrange
      const contact = createMockExtractedContact({
        name: 'John',
        email: null,
        phone: null,
        title: null,
      });

      // Act
      const result = ContactExtractionService.validateContact(contact);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('isGenericTemplateContact', () => {
    it('should identify generic template contact with info email in header', () => {
      // Arrange
      const contact = createMockExtractedContact({
        name: 'Contact Us',
        email: 'info@example.com',
        title: null,
        contactType: 'office',
        context: 'header navigation',
        sourceUrl: 'https://example.com/header',
        confidence: 'medium',
      });

      // Act
      const result = ContactExtractionService.isGenericTemplateContact(contact);

      // Assert
      expect(result).toBe(true);
    });

    it('should identify contact us as generic', () => {
      // Arrange
      const contact = createMockExtractedContact({
        name: 'Contact Us',
        email: 'sales@example.com',
        title: null,
        contactType: 'office',
        confidence: 'medium',
      });

      // Act
      const result = ContactExtractionService.isGenericTemplateContact(contact);

      // Assert
      expect(result).toBe(true);
    });

    it('should not identify specific contact as generic', () => {
      // Arrange
      const contact = createMockExtractedContact({
        name: 'John Doe',
        email: 'john.doe@example.com',
      });

      // Act
      const result = ContactExtractionService.isGenericTemplateContact(contact);

      // Assert
      expect(result).toBe(false);
    });

    it('should allow info email when not in template locations', () => {
      // Arrange
      const contact = createMockExtractedContact({
        name: 'Support Team',
        email: 'info@example.com',
        title: null,
        contactType: 'department',
        context: 'about page',
        sourceUrl: 'https://example.com/about',
        confidence: 'medium',
      });

      // Act
      const result = ContactExtractionService.isGenericTemplateContact(contact);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('transformToLeadContact', () => {
    it('should transform individual contact correctly', () => {
      // Arrange
      const contact = createMockExtractedContact({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '555-1234',
        title: 'CEO',
        company: 'Example Corp',
        context: 'Leadership Team',
        isPriorityContact: true,
        sourceUrl: 'https://example.com/about',
      });

      // Act
      const result = ContactExtractionService.transformToLeadContact(contact);

      // Assert
      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
      expect(result.phone).toBe('555-1234');
      expect(result.title).toBe('CEO (Leadership Team)');
      expect(result.company).toBe('Example Corp');
      expect(result.sourceUrl).toBe('https://example.com/about');
    });

    it('should add office suffix for office contacts', () => {
      // Arrange
      const contact = createMockExtractedContact({
        name: 'Boston',
        email: 'boston@example.com',
        title: null,
        contactType: 'office',
        confidence: 'medium',
      });

      // Act
      const result = ContactExtractionService.transformToLeadContact(contact);

      // Assert
      expect(result.name).toBe('Boston Office');
    });

    it('should add department suffix for department contacts', () => {
      // Arrange
      const contact = createMockExtractedContact({
        name: 'Marketing',
        email: 'marketing@example.com',
        title: null,
        contactType: 'department',
        confidence: 'medium',
      });

      // Act
      const result = ContactExtractionService.transformToLeadContact(contact);

      // Assert
      expect(result.name).toBe('Marketing Department');
    });

    it('should not add suffix if office already contains office keyword', () => {
      // Arrange
      const contact = createMockExtractedContact({
        name: 'Boston Office',
        email: 'boston@example.com',
        title: null,
        contactType: 'office',
        confidence: 'medium',
      });

      // Act
      const result = ContactExtractionService.transformToLeadContact(contact);

      // Assert
      expect(result.name).toBe('Boston Office');
    });

    it('should handle null company by setting it to null', () => {
      // Arrange
      const contact = createMockExtractedContact({
        company: '',
      });

      // Act
      const result = ContactExtractionService.transformToLeadContact(contact);

      // Assert
      expect(result.company).toBeNull();
    });

    it('should combine title and context correctly', () => {
      // Arrange
      const contact = createMockExtractedContact({
        title: 'CEO',
        context: 'Founder',
      });

      // Act
      const result = ContactExtractionService.transformToLeadContact(contact);

      // Assert
      expect(result.title).toBe('CEO (Founder)');
    });

    it('should use context as title when title is null', () => {
      // Arrange
      const contact = createMockExtractedContact({
        title: null,
        context: 'Leadership Team',
      });

      // Act
      const result = ContactExtractionService.transformToLeadContact(contact);

      // Assert
      expect(result.title).toBe('Leadership Team');
    });
  });

  describe('calculateContactSimilarity', () => {
    it('should return 1.0 for exact email match', () => {
      // Arrange
      const contact1 = createMockNewLeadPointOfContact({
        name: 'John Doe',
        email: 'john@example.com',
      });
      const contact2 = createMockLeadPointOfContact({
        name: 'Jane Smith',
        email: 'john@example.com',
        title: 'CTO',
      });

      // Act
      const result = ContactExtractionService.calculateContactSimilarity(contact1, contact2);

      // Assert
      expect(result).toBe(1.0);
    });

    it('should return 1.0 for exact phone match', () => {
      // Arrange
      const contact1 = createMockNewLeadPointOfContact({ email: null, phone: '5551234' });
      const contact2 = createMockLeadPointOfContact({
        name: 'Jane Smith',
        email: null,
        phone: '5551234',
        title: 'CTO',
      });

      // Act
      const result = ContactExtractionService.calculateContactSimilarity(contact1, contact2);

      // Assert
      expect(result).toBe(1.0);
    });

    it('should calculate weighted similarity for partial matches', () => {
      // Arrange
      const contact1 = createMockNewLeadPointOfContact({ email: 'john@example.com' });
      const contact2 = createMockLeadPointOfContact({ email: 'jane@example.com', title: 'CTO' });

      // Act
      const result = ContactExtractionService.calculateContactSimilarity(contact1, contact2);

      // Assert
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1.0);
    });

    it('should return 0 for completely different contacts', () => {
      // Arrange
      const contact1 = createMockNewLeadPointOfContact({
        name: 'John Doe',
        email: null,
        phone: null,
        title: null,
      });
      const contact2 = createMockLeadPointOfContact({
        name: 'Jane Smith',
        email: null,
        phone: null,
        title: null,
      });

      // Act
      const result = ContactExtractionService.calculateContactSimilarity(contact1, contact2);

      // Assert
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(1.0);
    });
  });

  describe('findSimilarContact', () => {
    it('should find similar contact above threshold', () => {
      // Arrange
      const newContact = createMockNewLeadPointOfContact();
      const existingContacts = [createMockLeadPointOfContact()];

      // Act
      const result = ContactExtractionService.findSimilarContact(newContact, existingContacts);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.id).toBe('1');
    });

    it('should return null when no similar contact found', () => {
      // Arrange
      const newContact = createMockNewLeadPointOfContact();
      const existingContacts = [
        createMockLeadPointOfContact({
          name: 'Jane Smith',
          email: 'jane@different.com',
          title: 'CTO',
        }),
      ];

      // Act
      const result = ContactExtractionService.findSimilarContact(newContact, existingContacts);

      // Assert
      expect(result).toBeNull();
    });

    it('should return best match when multiple similar contacts exist', () => {
      // Arrange
      const newContact = createMockNewLeadPointOfContact({ email: 'john@example.com' });
      const existingContacts = [
        createMockLeadPointOfContact({ id: '1', email: 'john.doe@example.com' }),
        createMockLeadPointOfContact({ id: '2', email: 'john@example.com' }),
      ];

      // Act
      const result = ContactExtractionService.findSimilarContact(newContact, existingContacts);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.id).toBe('2');
    });
  });

  describe('mergeContacts', () => {
    it('should merge contacts preferring new non-empty values', () => {
      // Arrange
      const existing = createMockLeadPointOfContact({
        name: 'Old Name',
        email: 'old@example.com',
        title: 'Old Title',
      });
      const newContact = createMockNewLeadPointOfContact({
        name: 'New Name',
        email: 'new@example.com',
        phone: '555-1234',
        title: 'New Title',
        company: 'New Company',
        sourceUrl: 'https://example.com',
      });

      // Act
      const result = ContactExtractionService.mergeContacts(existing, newContact);

      // Assert
      expect(result.name).toBe('New Name');
      expect(result.email).toBe('new@example.com');
      expect(result.phone).toBe('555-1234');
      expect(result.title).toBe('New Title');
      expect(result.company).toBe('New Company');
      expect(result.sourceUrl).toBe('https://example.com');
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should keep existing values when new values are empty', () => {
      // Arrange
      const existing = createMockLeadPointOfContact({
        name: 'Existing Name',
        email: 'existing@example.com',
        phone: '555-5678',
        title: 'Existing Title',
        company: 'Existing Company',
        sourceUrl: 'https://existing.com',
        emailVerificationResult: 'valid',
      });
      const newContact = createMockNewLeadPointOfContact({
        name: '',
        email: '',
        phone: '',
        title: '',
        company: '',
        sourceUrl: '',
      });

      // Act
      const result = ContactExtractionService.mergeContacts(existing, newContact);

      // Assert
      expect(result.name).toBe('Existing Name');
      expect(result.email).toBe('existing@example.com');
      expect(result.phone).toBe('555-5678');
      expect(result.title).toBe('Existing Title');
      expect(result.company).toBe('Existing Company');
      expect(result.sourceUrl).toBe('https://existing.com');
    });

    it('should update only provided new values', () => {
      // Arrange
      const existing = createMockLeadPointOfContact({
        name: 'Existing Name',
        email: 'existing@example.com',
        title: 'Existing Title',
      });
      const newContact = createMockNewLeadPointOfContact({
        email: 'new@example.com',
        phone: '555-1234',
      });

      // Act
      const result = ContactExtractionService.mergeContacts(existing, newContact);

      // Assert
      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('new@example.com');
      expect(result.phone).toBe('555-1234');
    });
  });

  describe('groupContactsForBatchOperations', () => {
    it('should group contacts into create and update operations', () => {
      // Arrange
      const existingContact: LeadPointOfContact = {
        id: '1',
        leadId: 'lead-1',
        name: 'Existing Contact',
        email: 'existing@example.com',
        phone: null,
        title: 'CEO',
        company: null,
        sourceUrl: null,
        emailVerificationResult: 'unknown',
        manuallyReviewed: false,
        strategyStatus: 'none',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const contactsToProcess = [
        {
          extractedContact: {
            name: 'New Contact',
            email: 'new@example.com',
            phone: null,
            title: 'CTO',
            company: null,
            contactType: 'individual' as const,
            context: null,
            isPriorityContact: false,
            address: null,
            linkedinUrl: null,
            websiteUrl: null,
            sourceUrl: null,
            confidence: 'high' as const,
          },
          leadContact: {
            name: 'New Contact',
            email: 'new@example.com',
            phone: null,
            title: 'CTO',
            company: null,
            sourceUrl: null,
          },
          similarContact: null,
        },
        {
          extractedContact: {
            name: 'Updated Contact',
            email: 'existing@example.com',
            phone: null,
            title: 'CEO',
            company: null,
            contactType: 'individual' as const,
            context: null,
            isPriorityContact: false,
            address: null,
            linkedinUrl: null,
            websiteUrl: null,
            sourceUrl: null,
            confidence: 'high' as const,
          },
          leadContact: {
            name: 'Updated Contact',
            email: 'existing@example.com',
            phone: null,
            title: 'CEO',
            company: null,
            sourceUrl: null,
          },
          similarContact: existingContact,
        },
      ];

      // Act
      const result = ContactExtractionService.groupContactsForBatchOperations(contactsToProcess);

      // Assert
      expect(result.contactsToCreate).toHaveLength(1);
      expect(result.contactsToCreate[0]?.name).toBe('New Contact');
      expect(result.contactsToUpdate).toHaveLength(1);
      expect(result.contactsToUpdate[0]?.id).toBe('1');
      expect(result.contactsToUpdate[0]?.data.name).toBe('Updated Contact');
    });

    it('should handle all new contacts', () => {
      // Arrange
      const contactsToProcess = [
        {
          extractedContact: {
            name: 'Contact 1',
            email: 'contact1@example.com',
            phone: null,
            title: null,
            company: null,
            contactType: 'individual' as const,
            context: null,
            isPriorityContact: false,
            address: null,
            linkedinUrl: null,
            websiteUrl: null,
            sourceUrl: null,
            confidence: 'high' as const,
          },
          leadContact: {
            name: 'Contact 1',
            email: 'contact1@example.com',
            phone: null,
            title: null,
            company: null,
            sourceUrl: null,
          },
          similarContact: null,
        },
        {
          extractedContact: {
            name: 'Contact 2',
            email: 'contact2@example.com',
            phone: null,
            title: null,
            company: null,
            contactType: 'individual' as const,
            context: null,
            isPriorityContact: false,
            address: null,
            linkedinUrl: null,
            websiteUrl: null,
            sourceUrl: null,
            confidence: 'high' as const,
          },
          leadContact: {
            name: 'Contact 2',
            email: 'contact2@example.com',
            phone: null,
            title: null,
            company: null,
            sourceUrl: null,
          },
          similarContact: null,
        },
      ];

      // Act
      const result = ContactExtractionService.groupContactsForBatchOperations(contactsToProcess);

      // Assert
      expect(result.contactsToCreate).toHaveLength(2);
      expect(result.contactsToUpdate).toHaveLength(0);
    });

    it('should handle all existing contacts', () => {
      // Arrange
      const existingContact1: LeadPointOfContact = {
        id: '1',
        leadId: 'lead-1',
        name: 'Contact 1',
        email: 'contact1@example.com',
        phone: null,
        title: null,
        company: null,
        sourceUrl: null,
        emailVerificationResult: 'unknown',
        manuallyReviewed: false,
        strategyStatus: 'none',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const existingContact2: LeadPointOfContact = {
        id: '2',
        leadId: 'lead-1',
        name: 'Contact 2',
        email: 'contact2@example.com',
        phone: null,
        title: null,
        company: null,
        sourceUrl: null,
        emailVerificationResult: 'unknown',
        manuallyReviewed: false,
        strategyStatus: 'none',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const contactsToProcess = [
        {
          extractedContact: {
            name: 'Contact 1 Updated',
            email: 'contact1@example.com',
            phone: null,
            title: null,
            company: null,
            contactType: 'individual' as const,
            context: null,
            isPriorityContact: false,
            address: null,
            linkedinUrl: null,
            websiteUrl: null,
            sourceUrl: null,
            confidence: 'high' as const,
          },
          leadContact: {
            name: 'Contact 1 Updated',
            email: 'contact1@example.com',
            phone: null,
            title: null,
            company: null,
            sourceUrl: null,
          },
          similarContact: existingContact1,
        },
        {
          extractedContact: {
            name: 'Contact 2 Updated',
            email: 'contact2@example.com',
            phone: null,
            title: null,
            company: null,
            contactType: 'individual' as const,
            context: null,
            isPriorityContact: false,
            address: null,
            linkedinUrl: null,
            websiteUrl: null,
            sourceUrl: null,
            confidence: 'high' as const,
          },
          leadContact: {
            name: 'Contact 2 Updated',
            email: 'contact2@example.com',
            phone: null,
            title: null,
            company: null,
            sourceUrl: null,
          },
          similarContact: existingContact2,
        },
      ];

      // Act
      const result = ContactExtractionService.groupContactsForBatchOperations(contactsToProcess);

      // Assert
      expect(result.contactsToCreate).toHaveLength(0);
      expect(result.contactsToUpdate).toHaveLength(2);
    });
  });

  describe('assignEmailVerificationResults', () => {
    it('should assign verification results to contacts with valid emails', () => {
      // Arrange
      const contactsToCreate = [
        createMockNewLeadPointOfContact({ email: 'john@example.com' }),
        createMockNewLeadPointOfContact({
          name: 'Jane Smith',
          email: 'jane@example.com',
          title: 'CTO',
        }),
      ];

      const emailVerificationResponses = {
        'john@example.com': { status: 'valid' },
        'jane@example.com': { status: 'valid' },
      };

      mockedEmailListVerifyClient.mapResultToEmailVerificationResult.mockReturnValue('valid');

      // Act
      ContactExtractionService.assignEmailVerificationResults(
        contactsToCreate,
        (contact) => contact.email,
        (contact, result) => {
          (contact as any).emailVerificationResult = result;
        },
        emailVerificationResponses
      );

      // Assert
      expect((contactsToCreate[0] as any).emailVerificationResult).toBe('valid');
      expect((contactsToCreate[1] as any).emailVerificationResult).toBe('valid');
      expect(mockedEmailListVerifyClient.mapResultToEmailVerificationResult).toHaveBeenCalledTimes(
        2
      );
    });

    it('should skip contacts without emails', () => {
      // Arrange
      const contactsToCreate = [
        createMockNewLeadPointOfContact({ email: null, phone: '555-1234' }),
      ];

      const emailVerificationResponses = {};

      // Act
      ContactExtractionService.assignEmailVerificationResults(
        contactsToCreate,
        (contact) => contact.email,
        (contact, result) => {
          (contact as any).emailVerificationResult = result;
        },
        emailVerificationResponses
      );

      // Assert
      expect((contactsToCreate[0] as any).emailVerificationResult).toBeUndefined();
      expect(mockedEmailListVerifyClient.mapResultToEmailVerificationResult).not.toHaveBeenCalled();
    });

    it('should handle missing verification results gracefully', () => {
      // Arrange
      const contactsToCreate = [createMockNewLeadPointOfContact()];

      const emailVerificationResponses = {};

      // Act
      ContactExtractionService.assignEmailVerificationResults(
        contactsToCreate,
        (contact) => contact.email,
        (contact, result) => {
          (contact as any).emailVerificationResult = result;
        },
        emailVerificationResponses
      );

      // Assert
      expect((contactsToCreate[0] as any).emailVerificationResult).toBeUndefined();
      expect(mockedEmailListVerifyClient.mapResultToEmailVerificationResult).not.toHaveBeenCalled();
    });

    it('should work with update contacts structure', () => {
      // Arrange
      const contactsToUpdate = [
        {
          id: '1',
          data: {
            email: 'updated@example.com',
          },
        },
      ];

      const emailVerificationResponses = {
        'updated@example.com': { status: 'invalid' },
      };

      mockedEmailListVerifyClient.mapResultToEmailVerificationResult.mockReturnValue('invalid');

      // Act
      ContactExtractionService.assignEmailVerificationResults(
        contactsToUpdate,
        (contact) => contact.data.email as string | null | undefined,
        (contact, result) => {
          (contact.data as any).emailVerificationResult = result;
        },
        emailVerificationResponses
      );

      // Assert
      expect((contactsToUpdate[0]?.data as any).emailVerificationResult).toBe('invalid');
      expect(mockedEmailListVerifyClient.mapResultToEmailVerificationResult).toHaveBeenCalledTimes(
        1
      );
    });
  });

  describe('transformAndMatchContacts', () => {
    it('should transform and match contacts correctly', () => {
      // Arrange
      const extractedContacts: ExtractedContact[] = [
        {
          name: 'John Doe',
          email: 'john@example.com',
          phone: null,
          title: 'CEO',
          company: null,
          contactType: 'individual',
          context: null,
          isPriorityContact: false,
          address: null,
          linkedinUrl: null,
          websiteUrl: null,
          sourceUrl: null,
          confidence: 'high',
        },
      ];

      const existingContacts: LeadPointOfContact[] = [
        {
          id: '1',
          leadId: 'lead-1',
          name: 'John Doe',
          email: 'john@example.com',
          phone: null,
          title: 'CEO',
          company: null,
          sourceUrl: null,
          emailVerificationResult: 'unknown',
          manuallyReviewed: false,
          strategyStatus: 'none',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Act
      const result = ContactExtractionService.transformAndMatchContacts(
        extractedContacts,
        existingContacts
      );

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]?.leadContact.name).toBe('John Doe');
      expect(result[0]?.similarContact).not.toBeNull();
      expect(result[0]?.similarContact?.id).toBe('1');
    });

    it('should handle contacts with no similar existing contact', () => {
      // Arrange
      const extractedContacts: ExtractedContact[] = [
        {
          name: 'New Contact',
          email: 'new@example.com',
          phone: null,
          title: 'CTO',
          company: null,
          contactType: 'individual',
          context: null,
          isPriorityContact: false,
          address: null,
          linkedinUrl: null,
          websiteUrl: null,
          sourceUrl: null,
          confidence: 'high',
        },
      ];

      const existingContacts: LeadPointOfContact[] = [];

      // Act
      const result = ContactExtractionService.transformAndMatchContacts(
        extractedContacts,
        existingContacts
      );

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]?.leadContact.name).toBe('New Contact');
      expect(result[0]?.similarContact).toBeNull();
    });

    it('should continue processing when transformation fails for one contact', () => {
      // Arrange
      const extractedContacts: ExtractedContact[] = [
        {
          name: 'Valid Contact',
          email: 'valid@example.com',
          phone: null,
          title: 'CEO',
          company: null,
          contactType: 'individual',
          context: null,
          isPriorityContact: false,
          address: null,
          linkedinUrl: null,
          websiteUrl: null,
          sourceUrl: null,
          confidence: 'high',
        },
        {
          name: 'Another Valid',
          email: 'another@example.com',
          phone: null,
          title: 'CTO',
          company: null,
          contactType: 'individual',
          context: null,
          isPriorityContact: false,
          address: null,
          linkedinUrl: null,
          websiteUrl: null,
          sourceUrl: null,
          confidence: 'high',
        },
      ];

      const existingContacts: LeadPointOfContact[] = [];

      // Act
      const result = ContactExtractionService.transformAndMatchContacts(
        extractedContacts,
        existingContacts
      );

      // Assert
      expect(result).toHaveLength(2);
    });

    it('should prevent duplicate matching of the same existing contact to multiple extracted contacts', () => {
      // Arrange - This scenario mimics the real issue where multiple extracted contacts
      // could match the same existing contact, causing duplicate updates
      const extractedContacts: ExtractedContact[] = [
        {
          name: 'James Helm',
          email: 'ryanhutchison@filevine.com',
          phone: '+18002157211',
          title: 'Founder, Attorney',
          company: 'Helm Law Group, LLC',
          contactType: 'individual',
          context: 'Founder profile referenced on the site',
          isPriorityContact: false,
          address: null,
          linkedinUrl: null,
          websiteUrl: null,
          sourceUrl: 'https://topdoglaw.com/attorneys/',
          confidence: 'high',
        },
        {
          name: 'Intake / Client Intake Team',
          email: 'intake@TopDogLaw.com',
          phone: '+18445762116',
          title: 'Client Intake',
          company: null,
          contactType: 'department',
          context: 'Primary intake email and phone listed on the Contact page',
          isPriorityContact: false,
          address: null,
          linkedinUrl: null,
          websiteUrl: null,
          sourceUrl: 'https://topdoglaw.com/contact/',
          confidence: 'high',
        },
      ];

      const existingContacts: LeadPointOfContact[] = [
        {
          id: 'd2buudrhd8n0wyaogju8l9am',
          leadId: 'tc9kqk8m9gldal6dnauef8c7',
          name: 'James Helm',
          email: 'ryanhutchison@filevine.com',
          phone: '+18445762116', // Same phone as the Intake contact
          title: 'Founder',
          company: null,
          sourceUrl: 'https://www.topdoglaw.com/',
          emailVerificationResult: 'ok_for_all',
          manuallyReviewed: false,
          strategyStatus: 'completed',
          createdAt: new Date('2025-10-02T17:43:23.638Z'),
          updatedAt: new Date('2025-10-02T18:52:07.192Z'),
        },
        {
          id: 'p1tznzmpltfc4hsna9njn0lj',
          leadId: 'tc9kqk8m9gldal6dnauef8c7',
          name: 'Phoenix Office',
          email: 'ryanzhutch@gmail.com',
          phone: '+16024289331',
          title: 'Regional Office',
          company: 'Helm Law Group, LLC',
          sourceUrl: 'https://www.topdoglaw.com',
          emailVerificationResult: 'unknown',
          manuallyReviewed: false,
          strategyStatus: 'completed',
          createdAt: new Date('2025-10-02T17:49:38.381Z'),
          updatedAt: new Date('2025-10-02T18:36:10.705Z'),
        },
      ];

      // Act
      const result = ContactExtractionService.transformAndMatchContacts(
        extractedContacts,
        existingContacts
      );

      // Assert - Check that no duplicate contact IDs are matched
      const matchedContactIds = result
        .map((r) => r.similarContact?.id)
        .filter((id): id is string => id !== null && id !== undefined);

      const uniqueMatchedIds = new Set(matchedContactIds);
      expect(matchedContactIds.length).toBe(uniqueMatchedIds.size);

      // Verify both extracted contacts were processed
      expect(result).toHaveLength(2);

      // One should be matched (James Helm to existing James Helm)
      const jamesResult = result.find((r) => r.extractedContact.name === 'James Helm');
      expect(jamesResult?.similarContact).not.toBeNull();
      expect(jamesResult?.similarContact?.id).toBe('d2buudrhd8n0wyaogju8l9am');

      // The other should be a new contact (Intake Team)
      const intakeResult = result.find(
        (r) => r.extractedContact.name === 'Intake / Client Intake Team'
      );
      expect(intakeResult?.similarContact).toBeNull();

      // Now verify that groupContactsForBatchOperations produces no duplicate IDs
      const { contactsToCreate, contactsToUpdate } =
        ContactExtractionService.groupContactsForBatchOperations(result);

      // Extract all update IDs
      const updateIds = contactsToUpdate.map((u) => u.id);
      const uniqueUpdateIds = new Set(updateIds);

      // Verify no duplicates in updates
      expect(updateIds.length).toBe(uniqueUpdateIds.size);
      expect(updateIds).toHaveLength(1); // Only James Helm should be updated
      expect(updateIds[0]).toBe('d2buudrhd8n0wyaogju8l9am');

      // Verify the Intake contact is in the create list
      expect(contactsToCreate).toHaveLength(1);
      expect(contactsToCreate[0]?.name).toBe('Intake / Client Intake Team');
    });
  });
});
