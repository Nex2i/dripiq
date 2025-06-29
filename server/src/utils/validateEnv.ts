import { Type } from '@sinclair/typebox';

export const schema = Type.Object({
  API_VERSION: Type.String(),
  PORT: Type.String(),
});
