import { v4 as uuidv4 } from 'uuid';

export const Guid = (cut?: boolean): string => {
  if (cut) {
    return uuidv4().split('-')[0]!;
  }
  return uuidv4();
};
