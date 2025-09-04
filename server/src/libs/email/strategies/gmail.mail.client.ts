import { gmail_v1, google } from 'googleapis';
import { logger } from '@/libs/logger';
import { EmailSendBase, ProviderIds } from '../email.types';
import { IEmailStrategy } from './IEmailStrategy';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.FRONTEND_ORIGIN;

if (!CLIENT_ID) {
  logger.error('Missing Google Client ID');
  throw new Error('Missing Google Client ID');
}

if (!CLIENT_SECRET) {
  logger.error('Missing Google Client Secret');
  throw new Error('Missing Google Client Secret');
}

if (!REDIRECT_URI) {
  logger.error('Missing Google Redirect URI');
  throw new Error('Missing Google Redirect URI');
}

export class GmailMailClient implements IEmailStrategy {
  private gmail: gmail_v1.Gmail;
  constructor(accessToken: string) {
    const googleAuth = new google.auth.OAuth2({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      redirectUri: REDIRECT_URI,
    });
    googleAuth.setCredentials({ access_token: accessToken });
    this.gmail = google.gmail({ version: 'v1', auth: googleAuth });
  }
  async sendEmail(email: Partial<EmailSendBase>): Promise<ProviderIds> {
    const base64Email = this.buildBase64Email(email);

    const response = await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: base64Email.raw,
      },
    });

    logger.info('Gmail email sent', {
      email,
      response,
    });

    return {
      providerMessageId: response.data.id || undefined,
      responseStatus: response.status || 200,
      responseHeaders: response.headers || {},
    };
  }

  private buildBase64Email(email: Partial<EmailSendBase>): { raw: string } {
    const emailLines = [
      `From: ${email.from}`,
      `To: ${email.to}`,
      `Subject: ${email.subject}`,
      `Date: ${new Date().toISOString()}`,
      `Content-Transfer-Encoding: base64`,
      `Content-Disposition: inline`,
      `Content-ID: <${email.outboundMessageId}>`,
      `Message-ID: <${email.outboundMessageId}>`,
      `References: <${email.outboundMessageId}>`,
      ...(email.html ? [`Content-Type: text/html; charset=utf-8`, email.html] : []),
      ...(email.text ? [`Content-Type: text/plain; charset=utf-8`, email.text] : []),
    ];

    return {
      raw: Buffer.from(emailLines.join('\n')).toString('base64'),
    };
  }
}
