import { mailAccountRepository, oauthTokenRepository } from '@/repositories';
import { EmailSendBase, ProviderIds } from './email.types';
import { GmailMailClient } from './strategies/gmail.mail.client';
import { OutlookMailClient } from './strategies/outlook.mail.client';
import { IEmailStrategy } from './strategies/IEmailStrategy';
import { logger } from '@/libs/logger';

class EmailOrchestrator {
  async sendEmail(userId: string, email: Partial<EmailSendBase>): Promise<ProviderIds> {
    const userEmailProvider = await this.getUserEmailProvider(userId);
    const result = await userEmailProvider.sendEmail(email);
    
    // Set up push notifications for reply tracking after email is sent
    this.setupReplyTracking(userId).catch(error => {
      logger.warn('Failed to setup reply tracking after email send', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
    });
    
    return result;
  }

  private async setupReplyTracking(userId: string): Promise<void> {
    try {
      // Import the setup functions dynamically to avoid circular dependency
      const { setupGmailWatch, setupOutlookSubscription } = await import('../routes/emailReply.webhook.routes');
      
      // Set up both Gmail and Outlook push notifications
      // These functions will silently fail if the user doesn't have the respective accounts
      await Promise.allSettled([
        setupGmailWatch(userId),
        setupOutlookSubscription(userId),
      ]);
    } catch (error) {
      logger.error('Error setting up reply tracking', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
    }
  }

  private async getUserEmailProvider(userId: string): Promise<IEmailStrategy> {
    const primaryMailAccount = await mailAccountRepository.findPrimaryByUserId(userId);

    switch (primaryMailAccount.provider) {
      case 'google':
        return await this.getGmailMailClient(primaryMailAccount.id);
      case 'microsoft':
        return await this.getOutlookMailClient(primaryMailAccount.id);
    }
  }

  private async getGmailMailClient(primaryMailAccountId: string): Promise<GmailMailClient> {
    const mailRefreshToken =
      await oauthTokenRepository.getRefreshTokenByMailAccountId(primaryMailAccountId);
    return new GmailMailClient(mailRefreshToken);
  }

  private async getOutlookMailClient(primaryMailAccountId: string): Promise<OutlookMailClient> {
    const mailRefreshToken =
      await oauthTokenRepository.getRefreshTokenByMailAccountId(primaryMailAccountId);
    return new OutlookMailClient(mailRefreshToken);
  }
}

export const emailOrchestrator = new EmailOrchestrator();
