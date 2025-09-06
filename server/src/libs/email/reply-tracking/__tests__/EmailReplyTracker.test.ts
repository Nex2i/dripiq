import { EmailReplyTracker, InboundEmailData } from '../EmailReplyTracker';
import { db } from '@/db';
import { emailThreads, inboundMessages, outboundMessages, messageEvents } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Mock the database
jest.mock('@/db');
const mockDb = db as jest.Mocked<typeof db>;

describe('EmailReplyTracker', () => {
  let emailReplyTracker: EmailReplyTracker;

  beforeEach(() => {
    emailReplyTracker = new EmailReplyTracker();
    jest.clearAllMocks();
  });

  describe('processInboundEmail', () => {
    it('should identify a reply using In-Reply-To header', async () => {
      const inboundEmail: InboundEmailData = {
        providerMessageId: 'msg-123',
        fromEmail: 'customer@example.com',
        toEmail: 'sales@company.com',
        subject: 'Re: Your product inquiry',
        bodyText: 'Thanks for the information!',
        messageId: '<reply-123@example.com>',
        inReplyTo: '<original-123@company.com>',
        receivedAt: new Date(),
      };

      // Mock database responses
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            limit: jest.fn().mockResolvedValueOnce([
              {
                id: 'thread-123',
                tenantId: 'tenant-123',
                campaignId: 'campaign-123',
                contactId: 'contact-123',
                originalMessageId: 'outbound-123',
              },
            ]),
          }),
        }),
      } as any);

      mockDb.insert.mockReturnValueOnce({
        values: jest.fn().mockResolvedValueOnce(undefined),
      } as any);

      mockDb.update.mockReturnValueOnce({
        set: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockResolvedValueOnce(undefined),
        }),
      } as any);

      const result = await emailReplyTracker.processInboundEmail(inboundEmail);

      expect(result.threadMatch.isReply).toBe(true);
      expect(result.threadMatch.matchMethod).toBe('message-id');
      expect(result.threadMatch.confidence).toBe('high');
      expect(result.processed).toBe(true);
    });

    it('should handle emails that are not replies', async () => {
      const inboundEmail: InboundEmailData = {
        providerMessageId: 'msg-456',
        fromEmail: 'newcustomer@example.com',
        toEmail: 'sales@company.com',
        subject: 'New inquiry about your services',
        bodyText: 'I am interested in your services.',
        messageId: '<new-inquiry-456@example.com>',
        receivedAt: new Date(),
      };

      // Mock database responses to return no matches
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      mockDb.insert.mockReturnValueOnce({
        values: jest.fn().mockResolvedValueOnce(undefined),
      } as any);

      const result = await emailReplyTracker.processInboundEmail(inboundEmail);

      expect(result.threadMatch.isReply).toBe(false);
      expect(result.threadMatch.matchMethod).toBe('none');
      expect(result.processed).toBe(false);
    });
  });

  describe('createEmailThread', () => {
    it('should create a new email thread', async () => {
      const tenantId = 'tenant-123';
      const campaignId = 'campaign-123';
      const contactId = 'contact-123';
      const outboundMessageId = 'outbound-123';
      const messageId = '<original-123@company.com>';
      const providerThreadId = 'provider-thread-123';

      mockDb.insert.mockReturnValueOnce({
        values: jest.fn().mockResolvedValueOnce(undefined),
      } as any);

      const threadId = await emailReplyTracker.createEmailThread(
        tenantId,
        campaignId,
        contactId,
        outboundMessageId,
        messageId,
        providerThreadId
      );

      expect(threadId).toBeDefined();
      expect(typeof threadId).toBe('string');
      expect(mockDb.insert).toHaveBeenCalledWith(emailThreads);
    });
  });
});