import { Type } from '@sinclair/typebox';

export const ssoRegisterBodySchema = Type.Object({
  name: Type.String(),
  tenantName: Type.String(),
});

export const ssoRegisterSuccessResponseSchema = Type.Object({
  status: Type.Literal('registered'),
  message: Type.String(),
  user: Type.Object({
    id: Type.String(),
    email: Type.String(),
    name: Type.Union([Type.String(), Type.Null()]),
  }),
  tenant: Type.Object({
    id: Type.String(),
    name: Type.String(),
  }),
});

export const ssoRegisterConflictResponseSchema = Type.Object({
  status: Type.Union([Type.Literal('domain_conflict'), Type.Literal('linking_required')]),
  message: Type.String(),
  email: Type.String(),
});
