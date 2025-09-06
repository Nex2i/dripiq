import { Client } from '@microsoft/microsoft-graph-client';
import { getMicrosoftOAuth2Client } from '@/libs/thirdPartyAuth/MicrosoftAuth';
import { logger } from '@/libs/logger';
import { EmailSendBase, ProviderIds } from '../email.types';
import { IEmailStrategy } from './IEmailStrategy';

export class OutlookMailClient implements IEmailStrategy {
  private graphClient: Client;
  private refreshToken: string;

  constructor(refreshToken: string) {
    this.refreshToken = refreshToken;
    this.graphClient = this.createGraphClient();
  }

  private createGraphClient(): Client {
    return Client.init({
      authProvider: async (done) => {
        try {
          // Get fresh access token using refresh token
          const oauth2Client = getMicrosoftOAuth2Client();
          const tokenResponse = await oauth2Client.refreshToken(this.refreshToken);

          done(null, tokenResponse.access_token);
        } catch (error) {
          logger.error('Failed to refresh Microsoft access token:', error);
          done(error, null);
        }
      },
    });
  }

  async sendEmail(email: Partial<EmailSendBase>): Promise<ProviderIds> {
    try {
      const { to, from, subject, html, text } = email;

      if (!to || !subject) {
        throw new Error('Missing required email fields: to, subject');
      }

      // Build the email message according to Microsoft Graph API format
      const message = {
        subject: subject,
        body: {
          contentType: html ? 'HTML' : 'Text',
          content: html || text || '',
        },
        toRecipients: [
          {
            emailAddress: {
              address: to,
            },
          },
        ],
        ...(from && {
          from: {
            emailAddress: {
              address: from,
            },
          },
        }),
      };

      // Send the email using Microsoft Graph API
      const response = await this.graphClient.api('/me/sendMail').post({
        message: message,
        saveToSentItems: true,
      });

      logger.info('Outlook email sent successfully', {
        to,
        subject,
        response,
      });

      return {
        providerMessageId: response?.id || undefined,
        responseStatus: 202, // Microsoft Graph typically returns 202 for successful sends
        responseHeaders: {},
      };
    } catch (error) {
      logger.error('Failed to send email via Outlook:', error);
      throw error;
    }
  }

  // Helper method to test the connection
  async testConnection(): Promise<boolean> {
    try {
      await this.graphClient.api('/me').get();
      return true;
    } catch (error) {
      logger.error('Outlook connection test failed:', error);
      return false;
    }
  }
}
