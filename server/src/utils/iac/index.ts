import * as SupabaseStorage from './SupabaseStorage';

const initIac = async () => {
  await SupabaseStorage.initSupabaseStorage();
};

export default initIac;
