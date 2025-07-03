import { supabase } from '@/libs/supabaseClient';
import { allowedStorageMimeTypes } from './allowedStorageMimeTypes';

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
      console.log(`${supaBaseBucket} bucket created`);
    } else {
      console.log(`${supaBaseBucket} bucket exists`);
    }
  } catch (error) {
    console.error(error);
  }
};
