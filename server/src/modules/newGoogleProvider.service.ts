import { TokenPayload } from 'google-auth-library';
import { MailAccount, NewMailAccount } from '@/db/schema';
import { getGoogleOAuth2Client } from '@/libs/thirdPartyAuth/GoogleAuth';
import { mailAccountRepository, oauthTokenRepository } from '@/repositories';
import { CreateOauthTokenPayload } from '@/repositories/entities/OauthTokenRepository';

class NewGoogleProviderService {
  async setupNewAccount(tenantId: string, userId: string, code: string): Promise<MailAccount> {
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

    if (!payload.sub) {
      throw new Error('Google account identity missing from ID token');
    }

    if (!tokens.refresh_token) {
      throw new Error('Failed to get refresh token');
    }

    const mailAccount = await this.createMailAccount(tenantId, userId, payload, tokens.scope);
    await this.createOAuthToken(mailAccount.id, tokens.refresh_token);
    return mailAccount;
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

    if (!sub) {
      throw new Error('Google account identity missing from ID token');
    }

    const existingMailAccount = await mailAccountRepository.findByProviderIdentity('google', sub);
    if (existingMailAccount) {
      if (existingMailAccount.tenantId !== tenantId || existingMailAccount.userId !== userId) {
        throw new Error('Google account is already connected to another user');
      }

      return await mailAccountRepository.reconnectProvider(userId, existingMailAccount.id, {
        primaryEmail: email || existingMailAccount.primaryEmail,
        displayName: name || existingMailAccount.displayName,
        scopes: scopes?.split(' ') || existingMailAccount.scopes,
      });
    }

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
