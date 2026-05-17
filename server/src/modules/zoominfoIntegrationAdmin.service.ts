import { getZoomInfoOAuthService } from '@/libs/webData/zoominfo.oauth.service';
import { tenantZoominfoCredentialsRepository } from '@/repositories';

export function maskZoomInfoClientIdForDisplay(clientId: string): string {
  if (clientId.length <= 8) {
    return '••••••••';
  }
  return `${clientId.slice(0, 4)}…${clientId.slice(-2)}`;
}

export async function getZoominfoAdminIntegrationStatus(tenantId: string): Promise<{
  configured: boolean;
  clientIdMasked: string | null;
}> {
  const row = await tenantZoominfoCredentialsRepository.findByTenantId(tenantId);
  if (!row) {
    return { configured: false, clientIdMasked: null };
  }
  return { configured: true, clientIdMasked: maskZoomInfoClientIdForDisplay(row.clientId) };
}

export async function saveZoominfoAdminCredentials(params: {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ clientIdMasked: string; message: string }> {
  const oauth = getZoomInfoOAuthService();
  await oauth.validateConnectionCredentials(params.clientId, params.clientSecret);

  await tenantZoominfoCredentialsRepository.upsertCredentials({
    tenantId: params.tenantId,
    clientId: params.clientId,
    clientSecret: params.clientSecret,
  });
  await oauth.invalidateTokenCache(params.tenantId);

  return {
    message: 'ZoomInfo credentials saved',
    clientIdMasked: maskZoomInfoClientIdForDisplay(params.clientId),
  };
}

export async function testZoominfoAdminCredentials(
  clientId: string,
  clientSecret: string
): Promise<void> {
  await getZoomInfoOAuthService().validateConnectionCredentials(clientId, clientSecret);
}

export async function removeZoominfoAdminIntegration(tenantId: string): Promise<void> {
  await tenantZoominfoCredentialsRepository.deleteByTenantId(tenantId);
  await getZoomInfoOAuthService().invalidateTokenCache(tenantId);
}
