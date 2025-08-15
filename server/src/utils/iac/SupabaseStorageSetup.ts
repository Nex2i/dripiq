import { supabase } from '@/libs/supabase.client';
import { logger } from '@/libs/logger';

const supaBaseBucket = process.env.SITE_STORAGE_BUCKET;

if (!supaBaseBucket) {
  throw new Error('SUPABASE_BUCKET is not set');
}

// use supabase to check if bucket exists. If it does, continue. If it does not, create it.

export const initSupabaseStorage = async () => {
  try {
    const bucket = await supabase.storage.getBucket(supaBaseBucket);

    if (!bucket?.data) {
      await supabase.storage.createBucket(supaBaseBucket, {
        public: false,
        // fileSizeLimit: 5 * 1024 * 1024 * 1024, // 5gb
        // allowedMimeTypes: allowedStorageMimeTypes,
      });
      logger.info(`${supaBaseBucket} bucket created`);
    } else {
      logger.info(`${supaBaseBucket} bucket exists`);
    }
  } catch (error) {
    logger.error('Failed to initialize Supabase storage', error);
  }
};
