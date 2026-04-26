import { TokenPayload } from 'google-auth-library';
import { getGoogleOAuth2Client } from '@/libs/thirdPartyAuth/GoogleAuth';
import { getMicrosoftOAuth2Client, MicrosoftUserInfo } from '@/libs/thirdPartyAuth/MicrosoftAuth';
import {
  calendarConnectionRepository,
  mailAccountRepository,
  oauthTokenRepository,
} from '@/repositories';
import { CalendarConnection, MailAccount, NewMailAccount } from '@/db/schema';
import { CreateOauthTokenPayload } from '@/repositories/entities/OauthTokenRepository';

export class CalendarConnectionService {
  async connectMailAccountCalendar(params: {
    tenantId: string;
    userId: string;
    mailAccountId: string;
    provider: 'google' | 'microsoft';
    primaryEmail?: string;
    displayName?: string | null;
    scopes?: string[];
  }): Promise<CalendarConnection | undefined> {
    if (!this.hasCalendarScopes(params.provider, params.scopes ?? [])) {
      return undefined;
    }

    return await calendarConnectionRepository.upsertActiveForUser(params.tenantId, params.userId, {
      mailAccountId: params.mailAccountId,
      provider: params.provider,
      providerCalendarId: 'primary',
      displayName: params.displayName ?? undefined,
      primaryEmail: params.primaryEmail,
      scopes: params.scopes ?? [],
      metadata: {},
      connectedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async setupGoogleConnection(
    tenantId: string,
    userId: string,
    code: string
  ): Promise<CalendarConnection> {
    const oauth2Client = getGoogleOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    if (!tokens.id_token) {
      throw new Error('Google ID token missing from calendar OAuth response');
    }

    if (!tokens.refresh_token) {
      throw new Error('Google refresh token missing from calendar OAuth response');
    }

    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) {
      throw new Error('Google account identity missing from calendar OAuth response');
    }

    const mailAccount = await this.findOrCreateMailAccount(tenantId, userId, payload, tokens.scope);
    await this.storeRefreshToken(mailAccount.id, tokens.refresh_token);

    return await calendarConnectionRepository.upsertActiveForUser(tenantId, userId, {
      mailAccountId: mailAccount.id,
      provider: 'google',
      providerCalendarId: 'primary',
      displayName: payload.name,
      primaryEmail: payload.email,
      scopes: tokens.scope?.split(' ') ?? [],
      metadata: {},
      connectedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async getActiveConnection(tenantId: string, userId: string): Promise<CalendarConnection | undefined> {
    return await calendarConnectionRepository.findActiveForUser(tenantId, userId);
  }

  async setupMicrosoftConnection(
    tenantId: string,
    userId: string,
    code: string
  ): Promise<CalendarConnection> {
    const oauth2Client = getMicrosoftOAuth2Client();
    const tokenResponse = await oauth2Client.getToken(code);

    if (!tokenResponse.refresh_token) {
      throw new Error('Microsoft refresh token missing from calendar OAuth response');
    }

    const userInfo = await oauth2Client.getUserInfo(tokenResponse.access_token);
    const mailAccount = await this.findOrCreateMicrosoftMailAccount(
      tenantId,
      userId,
      userInfo,
      tokenResponse.scope
    );
    await this.storeRefreshToken(mailAccount.id, tokenResponse.refresh_token);

    return await calendarConnectionRepository.upsertActiveForUser(tenantId, userId, {
      mailAccountId: mailAccount.id,
      provider: 'microsoft',
      providerCalendarId: 'primary',
      displayName: userInfo.displayName,
      primaryEmail: userInfo.mail || userInfo.userPrincipalName,
      scopes: tokenResponse.scope?.split(' ') ?? [],
      metadata: {},
      connectedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  private async findOrCreateMailAccount(
    tenantId: string,
    userId: string,
    payload: TokenPayload,
    scopes?: string
  ): Promise<MailAccount> {
    const existing = (await mailAccountRepository.findAccountsByUserId(userId)).find(
      (account) => account.provider === 'google' && account.providerUserId === payload.sub
    );
    if (existing) return existing;

    const mailAccount: NewMailAccount = {
      tenantId,
      userId,
      provider: 'google',
      providerUserId: payload.sub,
      primaryEmail: payload.email || '',
      displayName: payload.name || '',
      scopes: scopes?.split(' ') || [],
    };

    return await mailAccountRepository.create(mailAccount);
  }

  private async findOrCreateMicrosoftMailAccount(
    tenantId: string,
    userId: string,
    userInfo: MicrosoftUserInfo,
    scopes?: string
  ): Promise<MailAccount> {
    const existing = (await mailAccountRepository.findAccountsByUserId(userId)).find(
      (account) => account.provider === 'microsoft' && account.providerUserId === userInfo.id
    );
    if (existing) return existing;

    const mailAccount: NewMailAccount = {
      tenantId,
      userId,
      provider: 'microsoft',
      providerUserId: userInfo.id,
      primaryEmail: userInfo.mail || userInfo.userPrincipalName,
      displayName: userInfo.displayName || '',
      scopes: scopes?.split(' ') || [],
    };

    return await mailAccountRepository.create(mailAccount);
  }

  private async storeRefreshToken(mailAccountId: string, refreshToken: string): Promise<void> {
    const newOauthToken: CreateOauthTokenPayload = {
      mailAccountId,
      refreshToken,
      tokenVersion: 1,
      status: 'active',
    };

    await oauthTokenRepository.createOAuth(newOauthToken);
  }

  private hasCalendarScopes(provider: 'google' | 'microsoft', scopes: string[]): boolean {
    const normalizedScopes = scopes.map((scope) => scope.toLowerCase());
    if (provider === 'google') {
      return normalizedScopes.includes('https://www.googleapis.com/auth/calendar.events');
    }

    return normalizedScopes.includes('calendars.readwrite');
  }
}

export const calendarConnectionService = new CalendarConnectionService();
