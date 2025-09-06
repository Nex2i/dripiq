import { gmail_v1, google } from 'googleapis';
import { logger } from '@/libs/logger';
import { EmailSendBase, ProviderIds } from '../email.types';
import { IEmailStrategy } from './IEmailStrategy';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!CLIENT_ID) {
  logger.error('Missing Google Client ID');
  throw new Error('Missing Google Client ID');
}

if (!CLIENT_SECRET) {
  logger.error('Missing Google Client Secret');
  throw new Error('Missing Google Client Secret');
}

export class GmailMailClient implements IEmailStrategy {
  private gmail: gmail_v1.Gmail;
  constructor(refreshToken: string) {
    const googleAuth = new google.auth.OAuth2({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
    });
    googleAuth.setCredentials({ refresh_token: refreshToken });
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
    const { to, from, subject, html, text } = email;

    const CRLF = '\r\n';
    const date = new Date().toUTCString();
    const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@example>`;
    const hasBoth = !!html && !!text;

    let rfc822: string;

    if (hasBoth) {
      const boundary = 'b_' + Math.random().toString(36).slice(2);
      rfc822 =
        `From: ${from}\r\n` +
        `To: ${to}\r\n` +
        `Subject: ${subject}\r\n` +
        `Date: ${date}\r\n` +
        `Message-ID: ${messageId}\r\n` +
        `MIME-Version: 1.0\r\n` +
        `Content-Type: multipart/alternative; boundary="${boundary}"\r\n` +
        CRLF +
        `--${boundary}\r\n` +
        `Content-Type: text/plain; charset="utf-8"\r\n` +
        `Content-Transfer-Encoding: 7bit\r\n` +
        CRLF +
        `${text}\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: text/html; charset="utf-8"\r\n` +
        `Content-Transfer-Encoding: 7bit\r\n` +
        CRLF +
        `${wrapHtml(html!)}\r\n` +
        `--${boundary}--\r\n`;
    } else {
      const isHtml = !!html;
      const body = isHtml ? wrapHtml(html!) : (text ?? '');
      rfc822 =
        `From: ${from}\r\n` +
        `To: ${to}\r\n` +
        `Subject: ${subject}\r\n` +
        `Date: ${date}\r\n` +
        `Message-ID: ${messageId}\r\n` +
        `MIME-Version: 1.0\r\n` +
        `Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset="utf-8"\r\n` +
        `Content-Transfer-Encoding: 7bit\r\n` +
        CRLF +
        body +
        CRLF;
    }

    return { raw: Buffer.from(rfc822, 'utf8').toString('base64url') };

    function wrapHtml(s: string) {
      // Optional but safer for some clients
      return /^<\s*html/i.test(s) ? s : `<!doctype html><html><body>${s}</body></html>`;
    }
  }
}
