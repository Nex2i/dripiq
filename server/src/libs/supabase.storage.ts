import { logger } from './logger';
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
          logger.error(`Error uploading file ${key}`, error);
        }

        return data;
      }

      const { data, error } = await supabase.storage.from(bucket).upload(key, file.fileBody, {
        contentType: file.contentType,
      });

      if (error) {
        logger.error(`Error uploading file ${key}`, error);
      }
      return data;
    } catch (error) {
      logger.error(`Error uploading file ${key}`, error);
    }
  },

  uploadFiles: async (key: string, files: IUploadFile[]) => {
    try {
      const promises = files.map((file) => supabaseStorage.uploadFile(key + '/' + file.slug, file));
      const results = await Promise.allSettled(promises);
      return results;
    } catch (error) {
      logger.error(`Error uploading files ${key}`, error);
    }
  },

  fileExists: async (key: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.storage.from(bucket).exists(key);
      if (error) {
        return false;
      }
      return !!data;
    } catch (_error) {
      return false;
    }
  },

  downloadFile: async (key: string): Promise<any | null> => {
    try {
      const { data, error } = await supabase.storage.from(bucket).download(key);
      if (error) {
        if (error.message.includes('not found') || error.message.includes('Object not found')) {
          return null;
        }
        logger.error(`Error downloading file ${key}`, error);
        return null;
      }

      if (data) {
        const text = await data.text();
        try {
          return JSON.parse(text);
        } catch (parseError) {
          logger.error(`Error parsing JSON from file ${key}`, parseError);
          return null;
        }
      }

      return null;
    } catch (error) {
      logger.error(`Error downloading file ${key}`, error);
      return null;
    }
  },

  uploadJsonFile: async (key: string, jsonData: any): Promise<any> => {
    try {
      const jsonString = JSON.stringify(jsonData, null, 2);
      const fileBlob = new Blob([jsonString], { type: 'application/json' });

      const file: IUploadFile = {
        contentType: 'application/json',
        fileName: key.split('/').pop() || 'data.json',
        fileBody: fileBlob,
        slug: '',
      };

      return await supabaseStorage.uploadFile(key, file);
    } catch (error) {
      logger.error(`Error uploading JSON file ${key}`, error);
      throw error;
    }
  },
};
