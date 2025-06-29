import bcrypt from 'bcrypt';
const saltRounds = 10;

export const cryptHash = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, saltRounds);
};

export const cryptHashSync = (password: string): string => {
  return bcrypt.hashSync(password, saltRounds);
};

export const stringMatchesHash = async (password: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};
