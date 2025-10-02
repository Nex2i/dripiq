import axios, { AxiosInstance } from 'axios';

/**
Documentation: https://api.emaillistverify.com/api-doc

Deliverability status
The verification result of an email address can fall into one of the following categories:

Result	Description
ok	Indicates that the email address is valid and deliverable.
email_disabled	Indicates that the email address is disabled or non-existent, resulting in bounced emails back to the sender.
dead_server	Indicates that the email domain does not exist or lacks proper MX server configuration, leading to bounced emails back to the sender.
invalid_mx	Indicates that the email domain has misconfigured MX servers, causing incoming emails to bounce back to the sender.
disposable	Indicates that the email domain is associated with temporary email addresses that are short-lived, potentially resulting in bounced emails or reaching unintended recipients.
spamtrap	Represents an email address designed as a decoy to attract and identify spam emails, potentially harming the sender's reputation. Incoming emails are delivered but flagged for monitoring.
ok_for_all	Indicates that the email domain accepts all emails, regardless of the recipient's actual existence. Incoming emails may or may not bounce back to the sender.
smtp_protocol	Signifies that the SMTP communication unexpectedly terminated before verifying deliverability status. No credits are deducted for this verification request.
antispam_system	Indicates that the destination server's anti-spam measures prevented deliverability status verification. No credits are deducted for this verification request.
unknown	Denotes an unknown error that prevented verification of email address deliverability. No credits are deducted for the verification request.
invalid_syntax	Indicates that the input value lacks a valid email address syntax. No credits are deducted for this verification request.
 */
class EmailListVerifyClient {
  private httpClient: AxiosInstance;

  constructor() {
    const apiKey = process.env.EMAIL_LIST_VERIFY_API_KEY;
    if (!apiKey) {
      throw new Error('EMAIL_LIST_VERIFY_API_KEY is not set');
    }

    this.httpClient = axios.create({
      baseURL: 'https://api.emaillistverify.com/api',
      headers: {
        'x-api-key': apiKey,
      },
    });
  }

  async verifyEmailDetailed(email: string): Promise<EmailListVerifyResponse> {
    if (!email.isValidEmail()) {
      throw new Error('EmailListVerifyClient:verifyEmailDetailed Invalid email address');
    }

    const response = await this.httpClient.get<EmailListVerifyResponse>(
      `/verifyEmailDetailed?email=${email}`
    );
    return response.data;
  }

  async canSendEmail(email: string): Promise<boolean> {
    const response = await this.verifyEmailDetailed(email);
    return this.isResultOk(response.result);
  }

  isResultOk(result: EmailListVerifyResult): boolean {
    return result === 'ok';
  }
}

type EmailListVerifyResult =
  | 'ok'
  | 'email_disabled'
  | 'dead_server'
  | 'invalid_mx'
  | 'disposable'
  | 'spamtrap'
  | 'ok_for_all'
  | 'smtp_protocol'
  | 'antispam_system'
  | 'unknown'
  | 'invalid_syntax';

export type EmailListVerifyResponse = {
  email: string;
  result: EmailListVerifyResult;
  internalResult: string;
  mxServer: string;
  mxServerIp: string;
  esp: string;
  account: string;
  tag: string | null;
  isRole: boolean;
  isFree: boolean;
  isNoReply: boolean;
  firstName: string;
  lastName: string;
  gender: string;
};

export const emailListVerifyClient = new EmailListVerifyClient();
