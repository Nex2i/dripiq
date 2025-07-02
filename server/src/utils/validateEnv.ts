import { Type } from '@sinclair/typebox';

export const schema = Type.Object({
  API_VERSION: Type.String(),
  PORT: Type.String(),
  // SEQ Configuration (optional for non-production environments)
  SEQ_SERVER_URL: Type.Optional(Type.String()),
  SEQ_API_KEY: Type.Optional(Type.String()),
});
