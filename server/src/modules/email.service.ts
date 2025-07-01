export interface InviteEmailData {
  email: string;
  firstName: string;
  inviteLink: string;
  workspaceName: string;
  inviterName: string;
}

export class EmailService {
  /**
   * Send invite email
   * For now, this is a placeholder that logs the email data
   * In production, this would integrate with Postmark or similar service
   */
  static async sendInviteEmail(data: InviteEmailData): Promise<{ messageId?: string }> {
    console.log('📧 Sending invite email:', {
      to: data.email,
      firstName: data.firstName,
      inviteLink: data.inviteLink,
      workspaceName: data.workspaceName,
      inviterName: data.inviterName,
    });

    // TODO: Integrate with actual email service (Postmark)
    // const emailTemplate = this.buildInviteEmailTemplate(data);
    // const result = await postmarkClient.sendEmail(emailTemplate);
    // return { messageId: result.MessageID };

    // For now, return a mock message ID
    return { messageId: `mock-${Date.now()}` };
  }

  /**
   * Build HTML email template for invitations
   */
  private static buildInviteEmailTemplate(data: InviteEmailData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>You're invited to DripIQ</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .button { 
            display: inline-block; 
            background: #007cba; 
            color: white; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 4px; 
            margin: 20px 0;
          }
          .footer { font-size: 12px; color: #666; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>You're invited to DripIQ</h1>
          </div>
          
          <p>Hi ${data.firstName},</p>
          
          <p>${data.inviterName} added you to the <strong>${data.workspaceName}</strong> workspace.</p>
          
          <p>Click the button below to set your password and get started.</p>
          
          <div style="text-align: center;">
            <a href="${data.inviteLink}" class="button">Accept invitation</a>
          </div>
          
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #007cba;">${data.inviteLink}</p>
          
          <div class="footer">
            <p>The link expires in 7 days.</p>
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}