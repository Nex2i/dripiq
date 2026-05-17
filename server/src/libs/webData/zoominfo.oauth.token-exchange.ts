import axios from 'axios';
import { logger } from '@/libs/logger';
import { ZOOMINFO_SCOPE_REQUEST, ZOOMINFO_TOKEN_URL } from '@/libs/webData/zoominfo.constants';
import type { ZoomInfoTokenResponse } from '@/libs/webData/zoominfo.types';
import { ZoomInfoApiError } from '@/exceptions/zoominfo.errors';

function summarizeTokenExchangeFailure(status: number, data: unknown): string {
  if (typeof data === 'object' && data && 'error' in data) {
    return String((data as { error?: string }).error);
  }
  return `HTTP ${status}`;
}

/**
 * Performs ZoomInfo OAuth client_credentials token exchange only (no caching, no scope checks).
 */
export async function exchangeZoomInfoClientCredentials(params: {
  clientId: string;
  clientSecret: string;
  /** Optional correlation for logs on unexpected failures */
  tenantId?: string;
}): Promise<ZoomInfoTokenResponse> {
  const body = new URLSearchParams();
  body.set('grant_type', 'client_credentials');
  body.set('scope', ZOOMINFO_SCOPE_REQUEST);

  try {
    const axiosResponse = await axios.post<ZoomInfoTokenResponse>(
      ZOOMINFO_TOKEN_URL,
      body.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          Authorization: `Basic ${Buffer.from(`${params.clientId}:${params.clientSecret}`).toString('base64')}`,
        },
        validateStatus: () => true,
      }
    );

    if (axiosResponse.status < 200 || axiosResponse.status >= 300) {
      throw new ZoomInfoApiError(
        axiosResponse.status,
        `ZoomInfo token request failed: ${summarizeTokenExchangeFailure(axiosResponse.status, axiosResponse.data)}`
      );
    }

    return axiosResponse.data;
  } catch (e) {
    if (e instanceof ZoomInfoApiError) {
      throw e;
    }
    logger.error('ZoomInfo token exchange failed', {
      ...(params.tenantId !== undefined ? { tenantId: params.tenantId } : {}),
      error: String(e),
    });
    throw new ZoomInfoApiError(500, `ZoomInfo token exchange failed: ${String(e)}`);
  }
}
