import {
  ConversationStorageService,
  AgentType,
  ConversationOutput,
} from '../ConversationStorageService';
import { supabaseStorage } from '@/libs/supabase.storage';

// Mock the supabase storage
jest.mock('@/libs/supabase.storage', () => ({
  supabaseStorage: {
    uploadJsonFile: jest.fn(),
  },
}));

const mockSupabaseStorage = supabaseStorage as jest.Mocked<typeof supabaseStorage>;

describe('ConversationStorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Enable storage by default for tests
    process.env.CONVERSATION_STORAGE_ENABLED = 'true';
  });

  afterEach(() => {
    delete process.env.CONVERSATION_STORAGE_ENABLED;
  });

  describe('generateConversationId', () => {
    it('should generate a unique conversation ID', () => {
      const id1 = ConversationStorageService.generateConversationId();
      const id2 = ConversationStorageService.generateConversationId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });
  });

  describe('createConversationMetadata', () => {
    it('should create conversation metadata with required fields', () => {
      const agentType: AgentType = 'contact-extraction';
      const tenantId = 'tenant-123';
      const input = { domain: 'example.com', leadId: 'lead-123' };
      const conversationId = 'conv-123';

      const metadata = ConversationStorageService.createConversationMetadata(
        agentType,
        tenantId,
        input,
        conversationId
      );

      expect(metadata).toEqual({
        conversationId: 'conv-123',
        tenantId: 'tenant-123',
        leadId: 'lead-123',
        contactId: undefined,
        agentType: 'contact-extraction',
        timestamp: expect.any(String),
        input: { domain: 'example.com', leadId: 'lead-123' },
        status: 'success',
      });
    });

    it('should generate conversation ID if not provided', () => {
      const metadata = ConversationStorageService.createConversationMetadata(
        'site-analysis',
        'tenant-123',
        { domain: 'example.com' }
      );

      expect(metadata.conversationId).toBeDefined();
      expect(typeof metadata.conversationId).toBe('string');
    });
  });

  describe('transformIntermediateSteps', () => {
    it('should transform agent intermediate steps correctly', () => {
      const intermediateSteps = [
        {
          action: {
            tool: 'RetrieveFullPageTool',
            toolInput: { url: 'https://example.com' },
            log: 'Retrieving page content',
          },
          observation: 'Page content retrieved successfully',
        },
        {
          action: {
            tool: 'ListDomainPagesTool',
            input: { domain: 'example.com' },
          },
          observation: 'Found 5 pages',
        },
      ];

      const transformedSteps =
        ConversationStorageService.transformIntermediateSteps(intermediateSteps);

      expect(transformedSteps).toHaveLength(2);
      expect(transformedSteps[0]).toEqual({
        stepNumber: 1,
        action: {
          tool: 'RetrieveFullPageTool',
          toolInput: { url: 'https://example.com' },
          log: 'Retrieving page content',
        },
        observation: 'Page content retrieved successfully',
        timestamp: expect.any(String),
      });
      expect(transformedSteps[1]).toEqual({
        stepNumber: 2,
        action: {
          tool: 'ListDomainPagesTool',
          toolInput: { domain: 'example.com' },
          log: undefined,
        },
        observation: 'Found 5 pages',
        timestamp: expect.any(String),
      });
    });

    it('should handle empty intermediate steps', () => {
      const transformedSteps = ConversationStorageService.transformIntermediateSteps([]);
      expect(transformedSteps).toEqual([]);
    });

    it('should handle null/undefined intermediate steps', () => {
      const transformedSteps = ConversationStorageService.transformIntermediateSteps(null as any);
      expect(transformedSteps).toEqual([]);
    });
  });

  describe('createConversationOutput', () => {
    it('should create complete conversation output', () => {
      const startTime = Date.now() - 5000; // 5 seconds ago
      const metadata = {
        conversationId: 'conv-123',
        tenantId: 'tenant-123',
        leadId: 'lead-123',
        agentType: 'contact-extraction' as AgentType,
        timestamp: new Date().toISOString(),
        input: { domain: 'example.com', leadId: 'lead-123' },
      };
      const systemPrompt = 'Extract contacts from the domain';
      const agentResult = {
        output: 'Contacts extracted successfully',
        intermediateSteps: [
          {
            action: { tool: 'RetrieveFullPageTool' },
            observation: 'Page retrieved',
          },
        ],
        finalResponseParsed: { contacts: [] },
      };

      const conversationOutput = ConversationStorageService.createConversationOutput(
        metadata,
        systemPrompt,
        agentResult,
        startTime
      );

      expect(conversationOutput).toEqual({
        conversationId: 'conv-123',
        tenantId: 'tenant-123',
        leadId: 'lead-123',
        contactId: undefined,
        agentType: 'contact-extraction',
        timestamp: expect.any(String),
        input: { domain: 'example.com', leadId: 'lead-123' },
        conversation: {
          systemPrompt: 'Extract contacts from the domain',
          totalIterations: 1,
          intermediateSteps: expect.arrayContaining([
            expect.objectContaining({
              stepNumber: 1,
              action: expect.objectContaining({ tool: 'RetrieveFullPageTool' }),
              observation: 'Page retrieved',
            }),
          ]),
          finalResponse: 'Contacts extracted successfully',
          finalResponseParsed: { contacts: [] },
        },
        metrics: {
          durationMs: expect.any(Number),
          modelUsed: 'gpt-4',
        },
        status: 'success',
        error: undefined,
      });

      expect(conversationOutput.metrics.durationMs).toBeGreaterThan(0);
    });

    it('should handle error in conversation output', () => {
      const startTime = Date.now();
      const metadata = {
        conversationId: 'conv-123',
        tenantId: 'tenant-123',
        agentType: 'contact-extraction' as AgentType,
        timestamp: new Date().toISOString(),
        input: { domain: 'example.com' },
      };
      const error = new Error('Test error');

      const conversationOutput = ConversationStorageService.createConversationOutput(
        metadata,
        'system prompt',
        { intermediateSteps: [], output: '' },
        startTime,
        error
      );

      expect(conversationOutput.status).toBe('error');
      expect(conversationOutput.error).toBe('Test error');
    });
  });

  describe('saveConversation', () => {
    it('should save conversation to storage', async () => {
      mockSupabaseStorage.uploadJsonFile.mockResolvedValue(undefined);

      const conversationData: ConversationOutput = {
        conversationId: 'conv-123',
        tenantId: 'tenant-123',
        agentType: 'contact-extraction',
        timestamp: new Date().toISOString(),
        input: { domain: 'example.com' },
        conversation: {
          systemPrompt: 'test prompt',
          totalIterations: 0,
          intermediateSteps: [],
          finalResponse: 'test response',
          finalResponseParsed: {},
        },
        metrics: {
          durationMs: 1000,
          modelUsed: 'gpt-4',
        },
        status: 'success',
      };

      await ConversationStorageService.saveConversation('contact-extraction', conversationData);

      expect(mockSupabaseStorage.uploadJsonFile).toHaveBeenCalledWith(
        expect.stringMatching(/^contact-extraction\/\d{8}_\d{6}-details\.json$/),
        conversationData
      );
    });

    it('should not save when storage is disabled', async () => {
      process.env.CONVERSATION_STORAGE_ENABLED = 'false';

      const conversationData: ConversationOutput = {
        conversationId: 'conv-123',
        tenantId: 'tenant-123',
        agentType: 'contact-extraction',
        timestamp: new Date().toISOString(),
        input: { domain: 'example.com' },
        conversation: {
          systemPrompt: 'test prompt',
          totalIterations: 0,
          intermediateSteps: [],
          finalResponse: 'test response',
          finalResponseParsed: {},
        },
        metrics: {
          durationMs: 1000,
          modelUsed: 'gpt-4',
        },
        status: 'success',
      };

      await ConversationStorageService.saveConversation('contact-extraction', conversationData);

      expect(mockSupabaseStorage.uploadJsonFile).not.toHaveBeenCalled();
    });

    it('should handle storage errors gracefully', async () => {
      const storageError = new Error('Storage failed');
      mockSupabaseStorage.uploadJsonFile.mockRejectedValue(storageError);

      const conversationData: ConversationOutput = {
        conversationId: 'conv-123',
        tenantId: 'tenant-123',
        agentType: 'contact-extraction',
        timestamp: new Date().toISOString(),
        input: { domain: 'example.com' },
        conversation: {
          systemPrompt: 'test prompt',
          totalIterations: 0,
          intermediateSteps: [],
          finalResponse: 'test response',
          finalResponseParsed: {},
        },
        metrics: {
          durationMs: 1000,
          modelUsed: 'gpt-4',
        },
        status: 'success',
      };

      // Should not throw error
      await expect(
        ConversationStorageService.saveConversation('contact-extraction', conversationData)
      ).resolves.toBeUndefined();
    });
  });

  describe('saveConversationAsync', () => {
    it('should call saveConversation asynchronously', () => {
      const spy = jest.spyOn(ConversationStorageService, 'saveConversation');
      spy.mockResolvedValue(undefined);

      const conversationData: ConversationOutput = {
        conversationId: 'conv-123',
        tenantId: 'tenant-123',
        agentType: 'contact-extraction',
        timestamp: new Date().toISOString(),
        input: { domain: 'example.com' },
        conversation: {
          systemPrompt: 'test prompt',
          totalIterations: 0,
          intermediateSteps: [],
          finalResponse: 'test response',
          finalResponseParsed: {},
        },
        metrics: {
          durationMs: 1000,
          modelUsed: 'gpt-4',
        },
        status: 'success',
      };

      ConversationStorageService.saveConversationAsync('contact-extraction', conversationData);

      expect(spy).toHaveBeenCalledWith('contact-extraction', conversationData);

      spy.mockRestore();
    });
  });
});
