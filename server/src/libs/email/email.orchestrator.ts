import { mailAccountRepository, oauthTokenRepository } from '@/repositories';
import { EmailSendBase, ProviderIds } from './email.types';
import { GmailMailClient } from './strategies/gmail.mail.client';
import { OutlookMailClient } from './strategies/outlook.mail.client';
import { IEmailStrategy } from './strategies/IEmailStrategy';

class EmailOrchestrator {
  async sendEmail(userId: string, email: Partial<EmailSendBase>): Promise<ProviderIds> {
    const userEmailProvider = await this.getUserEmailProvider(userId);
    return userEmailProvider.sendEmail(email);
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
