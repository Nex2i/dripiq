import { logger } from '@/libs/logger';
import { supabase } from '@/libs/supabase.client';

const bucket = process.env.SITE_STORAGE_BUCKET!;

const getSignedUrlExpiry = 60 * 60 * 24 * 30; // 30 days

export const storageService = {
  getUploadSigned: async (key: string): Promise<string> => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUploadUrl(key, { upsert: true });
      if (error) {
        throw error;
      }
      return data.signedUrl;
    } catch (error) {
      logger.error(`Error getting signed upload URL for ${key}: ${error}`);
      throw error;
    }
  },

  getSignedUrl: async (key: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(key, getSignedUrlExpiry);

      if (error?.stack?.includes('not found')) {
        return null;
      }

      if (error) {
        throw error;
      }
      return data.signedUrl;
    } catch (error) {
      logger.error(`Error getting signed URL for ${key}: ${error}`);
      throw error;
    }
  },

  getTenantDomainLogoKey: (tenantId: string, domain?: string | null) => {
    const cleanedDomain = domain?.getDomain();
    return `${tenantId}/${cleanedDomain}/images/logo`;
  },
};
