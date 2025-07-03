import * as SupabaseStorage from './SupabaseStorageSetup';

const initIac = async () => {
  await SupabaseStorage.initSupabaseStorage();
};

export default initIac;
