import { supabase } from './supabase.client';

const bucket = process.env.SITE_STORAGE_BUCKET;

if (!bucket) {
  throw new Error('SUPABASE_STORAGE_BUCKET is not set');
}

export interface IUploadFile {
  contentType?: string;
  // if fileName is not provided, it will be the same as the key, expects to contain the file extension
  fileName?: string;
  fileBody: Blob;
  slug: string;
}

export const supabaseStorage = {
  uploadFile: async (key: string, file: IUploadFile) => {
    try {
      // var fileBuffer = Buffer.from(await file.fileBody.arrayBuffer());
      const { data: existingFile, error: existingFileError } = await supabase.storage
        .from(bucket)
        .exists(key);

      if (existingFileError || existingFile) {
        const { data, error } = await supabase.storage.from(bucket).update(key, file.fileBody, {
          contentType: file.contentType,
        });

        if (error) {
          throw error;
        }

        return data;
      }

      const { data, error } = await supabase.storage.from(bucket).upload(key, file.fileBody, {
        contentType: file.contentType,
      });

      if (error) {
        throw error;
      }
      return data;
    } catch (error) {
      throw error;
    }
  },

  uploadFiles: async (key: string, files: IUploadFile[]) => {
    try {
      const promises = files.map((file) =>
        supabaseStorage.uploadFile(key + '/' + file.fileName, file)
      );
      const results = await Promise.allSettled(promises);
      return results;
    } catch (error) {
      throw error;
    }
  },
};
