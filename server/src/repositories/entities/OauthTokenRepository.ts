import { eq, and } from 'drizzle-orm';
import { oauthTokens, OauthToken, NewOauthToken, mailAccounts, tenants } from '@/db/schema';
import { NotFoundError } from '@/exceptions/error';
import { BaseRepository } from '../base/BaseRepository';
import { encrypt, decrypt } from '@/utils/crypto';

export type OauthTokenWithDetails = OauthToken & {
  mailAccount?: {
    id: string;
    provider: string;
    primaryEmail: string;
    tenantId: string;
  };
};
// Have this have the encrpt optional and the refreshToken added
export type CreateOauthTokenPayload = Omit<NewOauthToken, 'refreshTokenEnc'> & {
  refreshTokenEnc?: string;
  refreshToken: string;
};

/**
 * OauthTokenRepository manages OAuth tokens for connected email accounts.
 * Handles token storage, rotation, and status tracking with tenant isolation.
 * Provides secure token management with encryption support.
 */
export class OauthTokenRepository extends BaseRepository<
  typeof oauthTokens,
  OauthToken,
  NewOauthToken
> {
  constructor() {
    super(oauthTokens);
  }

  async createOAuth(oauthToken: CreateOauthTokenPayload): Promise<OauthToken> {
    oauthToken.refreshTokenEnc = encrypt(oauthToken.refreshToken);
    const result = await this.db
      .insert(this.table)
      .values({ ...oauthToken } as NewOauthToken)
      .returning();

    return result[0] as OauthToken;
  }

  /**
   * Find oAuthToken by UserId
   * Join with mailAccount and where userId = userId and isPrimary = true
   */
  async getRefreshTokenByMailAccountId(mailAccountId: string): Promise<string> {
    const result = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.mailAccountId, mailAccountId)))
      .limit(1);

    if (!result || !result[0]) {
      throw new NotFoundError(`OauthToken not found with mailAccountId: ${mailAccountId}`);
    }

    const { refreshTokenEnc } = result[0];
    return decrypt(refreshTokenEnc);
  }
}
