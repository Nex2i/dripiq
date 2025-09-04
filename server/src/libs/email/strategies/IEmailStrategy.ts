import { EmailSendBase, ProviderIds } from '../email.types';

export interface IEmailStrategy {
  sendEmail(email: Partial<EmailSendBase>): Promise<ProviderIds>;
}
