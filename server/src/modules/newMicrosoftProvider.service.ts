import { MailAccount, NewMailAccount } from '@/db/schema';
import { getMicrosoftOAuth2Client, MicrosoftUserInfo } from '@/libs/thirdPartyAuth/MicrosoftAuth';
import { mailAccountRepository, oauthTokenRepository } from '@/repositories';
import { CreateOauthTokenPayload } from '@/repositories/entities/OauthTokenRepository';

class NewMicrosoftProviderService {
  async setupNewAccount(tenantId: string, userId: string, code: string): Promise<void> {
    const oauth2Client = getMicrosoftOAuth2Client();

    // Exchange authorization code for tokens
    const tokenResponse = await oauth2Client.getToken(code);

    if (!tokenResponse.refresh_token) {
      throw new Error('Failed to get refresh token from Microsoft');
    }

    // Get provider user information
    const userInfo = await oauth2Client.getUserInfo(tokenResponse.access_token);

    const mailAccount = await this.createMailAccount(
      tenantId,
      userId,
      userInfo,
      tokenResponse.scope
    );
    await this.createOAuthToken(mailAccount.id, tokenResponse.refresh_token);
  }

  private async createOAuthToken(mailAccountId: string, refreshToken: string): Promise<void> {
    const newOauthToken: CreateOauthTokenPayload = {
      mailAccountId: mailAccountId,
      refreshToken: refreshToken,
      tokenVersion: 1,
      status: 'active',
    };

    await oauthTokenRepository.createOAuth(newOauthToken);
  }

  private async createMailAccount(
    tenantId: string,
    userId: string,
    userInfo: MicrosoftUserInfo,
    scopes?: string
  ): Promise<MailAccount> {
    const { id, displayName, mail, userPrincipalName } = userInfo;

    // Use mail if available, otherwise fall back to userPrincipalName
    const primaryEmail = mail || userPrincipalName;

    const mailAccount: NewMailAccount = {
      userId: userId,
      provider: 'microsoft',
      providerUserId: id,
      primaryEmail: primaryEmail,
      displayName: displayName || '',
      tenantId: tenantId,
      scopes: scopes?.split(' ') || [],
    };

    const newMailAccount = await mailAccountRepository.create(mailAccount);
    return newMailAccount;
  }
}

export const newMicrosoftProviderService = new NewMicrosoftProviderService();
