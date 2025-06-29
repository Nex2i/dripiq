export const stringToBool = (str: string): boolean => {
  return ['true', '1', 'yes'].includes(str.toLowerCase());
};
