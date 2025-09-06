import { logger } from '@/libs/logger';
import { db } from '@/db';
import { emailThreads, inboundMessages, outboundMessages, messageEvents } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

export interface InboundEmailData {
  providerMessageId: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  messageId?: string; // RFC 2822 Message-ID
  inReplyTo?: string; // RFC 2822 In-Reply-To
  references?: string; // RFC 2822 References
  conversationId?: string; // Provider-specific conversation ID
  threadId?: string; // Provider-specific thread ID
  receivedAt: Date;
  raw?: any; // Raw message data from provider
}

export interface ThreadMatchResult {
  threadId?: string;
  outboundMessageId?: string;
  campaignId?: string;
  contactId?: string;
  tenantId?: string;
  isReply: boolean;
  confidence: 'high' | 'medium' | 'low';
  matchMethod: 'message-id' | 'thread-id' | 'conversation-id' | 'subject' | 'none';
}

export class EmailReplyTracker {
  /**
   * Process an inbound email and determine if it's a reply to a tracked campaign
   */
  async processInboundEmail(emailData: InboundEmailData): Promise<{
    inboundMessageId: string;
    threadMatch: ThreadMatchResult;
    processed: boolean;
  }> {
    try {
      logger.info('[EmailReplyTracker] Processing inbound email', {
        providerMessageId: emailData.providerMessageId,
        fromEmail: emailData.fromEmail,
        subject: emailData.subject,
      });

      // First, try to match this email to an existing thread
      const threadMatch = await this.matchEmailToThread(emailData);

      // Create the inbound message record
      const inboundMessageId = createId();
      await db.insert(inboundMessages).values({
        id: inboundMessageId,
        tenantId: threadMatch.tenantId || 'unknown',
        campaignId: threadMatch.campaignId,
        contactId: threadMatch.contactId,
        outboundMessageId: threadMatch.outboundMessageId,
        threadId: threadMatch.threadId,
        channel: 'email',
        providerMessageId: emailData.providerMessageId,
        fromEmail: emailData.fromEmail,
        toEmail: emailData.toEmail,
        messageId: emailData.messageId,
        inReplyTo: emailData.inReplyTo,
        references: emailData.references,
        conversationId: emailData.conversationId,
        receivedAt: emailData.receivedAt,
        subject: emailData.subject,
        bodyText: emailData.bodyText,
        bodyHtml: emailData.bodyHtml,
        raw: emailData.raw,
        processed: threadMatch.isReply,
        processedAt: threadMatch.isReply ? new Date() : null,
      });

      // If this is a reply, update the thread and create a message event
      if (threadMatch.isReply && threadMatch.threadId && threadMatch.outboundMessageId) {
        await this.updateThreadWithReply(threadMatch.threadId, emailData.receivedAt);
        await this.createReplyEvent(threadMatch.outboundMessageId, threadMatch.tenantId!, inboundMessageId);
      }

      logger.info('[EmailReplyTracker] Inbound email processed', {
        inboundMessageId,
        isReply: threadMatch.isReply,
        matchMethod: threadMatch.matchMethod,
        confidence: threadMatch.confidence,
      });

      return {
        inboundMessageId,
        threadMatch,
        processed: threadMatch.isReply,
      };
    } catch (error) {
      logger.error('[EmailReplyTracker] Failed to process inbound email', {
        error: error instanceof Error ? error.message : 'Unknown error',
        emailData: {
          providerMessageId: emailData.providerMessageId,
          fromEmail: emailData.fromEmail,
          subject: emailData.subject,
        },
      });
      throw error;
    }
  }

  /**
   * Match an inbound email to an existing email thread
   */
  private async matchEmailToThread(emailData: InboundEmailData): Promise<ThreadMatchResult> {
    // Method 1: Direct Message-ID matching (highest confidence)
    if (emailData.inReplyTo) {
      const directMatch = await this.matchByMessageId(emailData.inReplyTo);
      if (directMatch.isReply) {
        return { ...directMatch, matchMethod: 'message-id', confidence: 'high' };
      }
    }

    // Method 2: References header parsing
    if (emailData.references) {
      const referencesMatch = await this.matchByReferences(emailData.references);
      if (referencesMatch.isReply) {
        return { ...referencesMatch, matchMethod: 'message-id', confidence: 'high' };
      }
    }

    // Method 3: Provider thread ID matching (Gmail)
    if (emailData.threadId) {
      const threadMatch = await this.matchByProviderThreadId(emailData.threadId);
      if (threadMatch.isReply) {
        return { ...threadMatch, matchMethod: 'thread-id', confidence: 'medium' };
      }
    }

    // Method 4: Provider conversation ID matching (Outlook)
    if (emailData.conversationId) {
      const conversationMatch = await this.matchByConversationId(emailData.conversationId);
      if (conversationMatch.isReply) {
        return { ...conversationMatch, matchMethod: 'conversation-id', confidence: 'medium' };
      }
    }

    // Method 5: Subject line matching (lowest confidence)
    const subjectMatch = await this.matchBySubject(emailData.subject, emailData.fromEmail);
    if (subjectMatch.isReply) {
      return { ...subjectMatch, matchMethod: 'subject', confidence: 'low' };
    }

    // No match found
    return {
      isReply: false,
      matchMethod: 'none',
      confidence: 'low',
    };
  }

  /**
   * Match by RFC 2822 Message-ID (In-Reply-To header)
   */
  private async matchByMessageId(messageId: string): Promise<ThreadMatchResult> {
    try {
      const thread = await db
        .select({
          id: emailThreads.id,
          tenantId: emailThreads.tenantId,
          campaignId: emailThreads.campaignId,
          contactId: emailThreads.contactId,
          originalMessageId: emailThreads.originalMessageId,
        })
        .from(emailThreads)
        .where(and(
          eq(emailThreads.messageId, messageId),
          eq(emailThreads.isActive, true)
        ))
        .limit(1);

      if (thread.length > 0) {
        return {
          threadId: thread[0].id,
          outboundMessageId: thread[0].originalMessageId,
          campaignId: thread[0].campaignId,
          contactId: thread[0].contactId,
          tenantId: thread[0].tenantId,
          isReply: true,
          confidence: 'high',
          matchMethod: 'message-id',
        };
      }

      return { isReply: false, confidence: 'low', matchMethod: 'message-id' };
    } catch (error) {
      logger.error('[EmailReplyTracker] Error matching by message ID', { error, messageId });
      return { isReply: false, confidence: 'low', matchMethod: 'message-id' };
    }
  }

  /**
   * Match by parsing References header for multiple Message-IDs
   */
  private async matchByReferences(references: string): Promise<ThreadMatchResult> {
    try {
      // Parse References header - format: <id1> <id2> <id3>
      const messageIds = references.match(/<[^>]+>/g)?.map(id => id.slice(1, -1)) || [];
      
      for (const messageId of messageIds) {
        const match = await this.matchByMessageId(messageId);
        if (match.isReply) {
          return match;
        }
      }

      return { isReply: false, confidence: 'low', matchMethod: 'message-id' };
    } catch (error) {
      logger.error('[EmailReplyTracker] Error matching by references', { error, references });
      return { isReply: false, confidence: 'low', matchMethod: 'message-id' };
    }
  }

  /**
   * Match by provider thread ID (Gmail)
   */
  private async matchByProviderThreadId(threadId: string): Promise<ThreadMatchResult> {
    try {
      const thread = await db
        .select({
          id: emailThreads.id,
          tenantId: emailThreads.tenantId,
          campaignId: emailThreads.campaignId,
          contactId: emailThreads.contactId,
          originalMessageId: emailThreads.originalMessageId,
        })
        .from(emailThreads)
        .where(and(
          eq(emailThreads.providerThreadId, threadId),
          eq(emailThreads.isActive, true)
        ))
        .limit(1);

      if (thread.length > 0) {
        return {
          threadId: thread[0].id,
          outboundMessageId: thread[0].originalMessageId,
          campaignId: thread[0].campaignId,
          contactId: thread[0].contactId,
          tenantId: thread[0].tenantId,
          isReply: true,
          confidence: 'medium',
          matchMethod: 'thread-id',
        };
      }

      return { isReply: false, confidence: 'low', matchMethod: 'thread-id' };
    } catch (error) {
      logger.error('[EmailReplyTracker] Error matching by thread ID', { error, threadId });
      return { isReply: false, confidence: 'low', matchMethod: 'thread-id' };
    }
  }

  /**
   * Match by conversation ID (Outlook)
   */
  private async matchByConversationId(conversationId: string): Promise<ThreadMatchResult> {
    try {
      // For Outlook, we might store conversation ID in the inbound_messages table
      // and link it back to threads
      const existingMessage = await db
        .select({
          threadId: inboundMessages.threadId,
          tenantId: inboundMessages.tenantId,
          campaignId: inboundMessages.campaignId,
          contactId: inboundMessages.contactId,
          outboundMessageId: inboundMessages.outboundMessageId,
        })
        .from(inboundMessages)
        .where(eq(inboundMessages.conversationId, conversationId))
        .limit(1);

      if (existingMessage.length > 0 && existingMessage[0].threadId) {
        return {
          threadId: existingMessage[0].threadId,
          outboundMessageId: existingMessage[0].outboundMessageId,
          campaignId: existingMessage[0].campaignId,
          contactId: existingMessage[0].contactId,
          tenantId: existingMessage[0].tenantId,
          isReply: true,
          confidence: 'medium',
          matchMethod: 'conversation-id',
        };
      }

      return { isReply: false, confidence: 'low', matchMethod: 'conversation-id' };
    } catch (error) {
      logger.error('[EmailReplyTracker] Error matching by conversation ID', { error, conversationId });
      return { isReply: false, confidence: 'low', matchMethod: 'conversation-id' };
    }
  }

  /**
   * Match by subject line (fallback method)
   */
  private async matchBySubject(subject: string, fromEmail: string): Promise<ThreadMatchResult> {
    try {
      // Clean subject line - remove Re:, Fwd:, etc.
      const cleanSubject = subject
        .replace(/^(Re:|RE:|Fwd:|FWD:|Fw:|FW:)\s*/i, '')
        .trim();

      // Look for outbound messages with similar subjects to the same contact
      const outboundMessage = await db
        .select({
          id: outboundMessages.id,
          tenantId: outboundMessages.tenantId,
          campaignId: outboundMessages.campaignId,
          contactId: outboundMessages.contactId,
          content: outboundMessages.content,
        })
        .from(outboundMessages)
        .where(eq(outboundMessages.channel, 'email'))
        .limit(50); // Limit to recent messages

      for (const message of outboundMessage) {
        const messageContent = message.content as any;
        if (messageContent?.subject && messageContent?.to === fromEmail) {
          const outboundSubject = messageContent.subject.replace(/^(Re:|RE:|Fwd:|FWD:|Fw:|FW:)\s*/i, '').trim();
          
          // Simple similarity check
          if (cleanSubject.includes(outboundSubject) || outboundSubject.includes(cleanSubject)) {
            // Check if we have a thread for this message
            const existingThread = await db
              .select({ id: emailThreads.id })
              .from(emailThreads)
              .where(eq(emailThreads.originalMessageId, message.id))
              .limit(1);

            if (existingThread.length > 0) {
              return {
                threadId: existingThread[0].id,
                outboundMessageId: message.id,
                campaignId: message.campaignId,
                contactId: message.contactId,
                tenantId: message.tenantId,
                isReply: true,
                confidence: 'low',
                matchMethod: 'subject',
              };
            }
          }
        }
      }

      return { isReply: false, confidence: 'low', matchMethod: 'subject' };
    } catch (error) {
      logger.error('[EmailReplyTracker] Error matching by subject', { error, subject, fromEmail });
      return { isReply: false, confidence: 'low', matchMethod: 'subject' };
    }
  }

  /**
   * Update thread with new reply information
   */
  private async updateThreadWithReply(threadId: string, replyReceivedAt: Date): Promise<void> {
    try {
      await db
        .update(emailThreads)
        .set({
          lastReplyAt: replyReceivedAt,
          replyCount: db.raw('reply_count + 1'),
          updatedAt: new Date(),
        })
        .where(eq(emailThreads.id, threadId));

      logger.info('[EmailReplyTracker] Thread updated with reply', { threadId, replyReceivedAt });
    } catch (error) {
      logger.error('[EmailReplyTracker] Failed to update thread', { error, threadId });
      throw error;
    }
  }

  /**
   * Create a reply event in the message events table
   */
  private async createReplyEvent(outboundMessageId: string, tenantId: string, inboundMessageId: string): Promise<void> {
    try {
      await db.insert(messageEvents).values({
        id: createId(),
        tenantId,
        messageId: outboundMessageId,
        type: 'reply',
        eventAt: new Date(),
        data: {
          inboundMessageId,
          source: 'email-reply-tracker',
        },
      });

      logger.info('[EmailReplyTracker] Reply event created', { outboundMessageId, inboundMessageId });
    } catch (error) {
      logger.error('[EmailReplyTracker] Failed to create reply event', { error, outboundMessageId });
      throw error;
    }
  }

  /**
   * Create a new email thread when sending an outbound message
   */
  async createEmailThread(
    tenantId: string,
    campaignId: string,
    contactId: string,
    outboundMessageId: string,
    messageId: string,
    providerThreadId?: string
  ): Promise<string> {
    try {
      const threadId = createId();
      
      await db.insert(emailThreads).values({
        id: threadId,
        tenantId,
        campaignId,
        contactId,
        originalMessageId: outboundMessageId,
        providerThreadId,
        messageId,
        isActive: true,
      });

      logger.info('[EmailReplyTracker] Email thread created', {
        threadId,
        tenantId,
        campaignId,
        contactId,
        outboundMessageId,
      });

      return threadId;
    } catch (error) {
      logger.error('[EmailReplyTracker] Failed to create email thread', {
        error,
        tenantId,
        campaignId,
        contactId,
        outboundMessageId,
      });
      throw error;
    }
  }
}

export const emailReplyTracker = new EmailReplyTracker();