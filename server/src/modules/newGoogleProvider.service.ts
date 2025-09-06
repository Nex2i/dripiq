import { MailAccount, NewMailAccount, NewOauthToken } from '@/db/schema';
import { getGoogleOAuth2Client } from '@/libs/thirdPartyAuth/GoogleAuth';
import { mailAccountRepository, oauthTokenRepository } from '@/repositories';
import { CreateOauthTokenPayload } from '@/repositories/entities/OauthTokenRepository';
import { TokenPayload } from 'google-auth-library';

class NewGoogleProviderService {
  async setupNewAccount(tenantId: string, userId: string, code: string): Promise<void> {
    const oauth2Client = getGoogleOAuth2Client();

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get provider user information
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      throw new Error('Failed to get user payload from ID token');
    }

    if (!tokens.refresh_token) {
      throw new Error('Failed to get refresh token');
    }

    const mailAccount = await this.createMailAccount(tenantId, userId, payload, tokens.scope);
    await this.createOAuthToken(mailAccount.id, tokens.refresh_token);
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
    tokenPayload: TokenPayload,
    scopes?: string
  ): Promise<MailAccount> {
    const { sub, email, name } = tokenPayload;

    const mailAccount: NewMailAccount = {
      userId: userId,
      provider: 'google',
      providerUserId: sub,
      primaryEmail: email || '',
      displayName: name || '',
      tenantId: tenantId,
      scopes: scopes?.split(' ') || [],
    };

    const newMailAccount = await mailAccountRepository.create(mailAccount);
    return newMailAccount;
  }
}

export const newGoogleProviderService = new NewGoogleProviderService();
