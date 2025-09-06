import axios from 'axios';

export interface MicrosoftTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
}

export interface MicrosoftUserInfo {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
  givenName?: string;
  surname?: string;
}

// Microsoft OAuth2 client configuration
export class MicrosoftOAuth2Client {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private tenant: string;

  constructor() {
    this.clientId = process.env.MICROSOFT_CLIENT_ID!;
    this.clientSecret = process.env.MICROSOFT_CLIENT_SECRET!;
    this.redirectUri = `${process.env.API_URL}/api/third-party/microsoft/callback`;
    this.tenant = process.env.MICROSOFT_TENANT_ID || 'common'; // 'common' supports all account types

    if (!this.clientId || !this.clientSecret) {
      throw new Error('Microsoft OAuth credentials not configured');
    }
  }

  generateAuthUrl(scopes: string[], state: string): string {
    const baseUrl = `https://login.microsoftonline.com/${this.tenant}/oauth2/v2.0/authorize`;
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: scopes.join(' '),
      state: state,
      response_mode: 'query',
      prompt: 'consent', // Force consent to ensure refresh token
    });

    return `${baseUrl}?${params.toString()}`;
  }

  async getToken(code: string): Promise<MicrosoftTokenResponse> {
    const tokenUrl = `https://login.microsoftonline.com/${this.tenant}/oauth2/v2.0/token`;

    const data = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code: code,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await axios.post(tokenUrl, data, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return response.data;
  }

  async getUserInfo(accessToken: string): Promise<MicrosoftUserInfo> {
    const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.data;
  }

  async refreshToken(refreshToken: string): Promise<MicrosoftTokenResponse> {
    const tokenUrl = `https://login.microsoftonline.com/${this.tenant}/oauth2/v2.0/token`;

    const data = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await axios.post(tokenUrl, data, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return response.data;
  }
}

export const getMicrosoftOAuth2Client = () => {
  return new MicrosoftOAuth2Client();
};
