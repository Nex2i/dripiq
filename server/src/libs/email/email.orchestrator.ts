import { mailAccountRepository, oauthTokenRepository } from '@/repositories';
import { EmailSendBase, ProviderIds } from './email.types';
import { GmailMailClient } from './strategies/gmail.mail.client';
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
        const mailRefreshToken = await oauthTokenRepository.getRefreshTokenByMailAccountId(
          primaryMailAccount.id
        );
        return new GmailMailClient(mailRefreshToken);
      case 'microsoft':
        // TODO: Implement Microsoft Mail Client
        throw new Error('Microsoft Mail Client not implemented');
    }
  }
}

export const emailOrchestrator = new EmailOrchestrator();
