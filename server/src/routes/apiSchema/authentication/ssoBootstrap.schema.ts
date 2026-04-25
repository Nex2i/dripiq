import { Type } from '@sinclair/typebox';

export const ssoBootstrapSuccessResponseSchema = Type.Object({
  status: Type.Union([Type.Literal('already_provisioned'), Type.Literal('provisioned')]),
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

export const ssoBootstrapRequiresRegistrationResponseSchema = Type.Object({
  status: Type.Literal('requires_registration'),
  email: Type.String(),
  domain: Type.String(),
});

export const ssoBootstrapConflictResponseSchema = Type.Object({
  status: Type.Literal('linking_required'),
  message: Type.String(),
  email: Type.String(),
});
