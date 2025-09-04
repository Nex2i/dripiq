import { EmailSendBase, ProviderIds } from './email.types';
import { GmailMailClient } from './strategies/gmail.mail.client';
import { IEmailStrategy } from './strategies/IEmailStrategy';

class EmailOrchestrator {
  async sendEmail(userId: string, email: Partial<EmailSendBase>): Promise<ProviderIds> {
    const userEmailProvider = await this.getUserEmailProvider(userId);
    return userEmailProvider.sendEmail(email);
  }

  private async getUserEmailProvider(userId: string): Promise<IEmailStrategy> {
    return new GmailMailClient(userId);
  }
}

export const emailOrchestrator = new EmailOrchestrator();
