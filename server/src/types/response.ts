import { Type } from '@fastify/type-provider-typebox';

// Create a default route response for all routes,
export const defaultRouteResponse = () => {
  return {
    200: Type.Object({
      message: Type.String(),
    }),
    400: Type.Object({
      message: Type.String(),
      error: Type.Optional(Type.String()),
    }),
    401: Type.Object({
      message: Type.String(),
      error: Type.Optional(Type.String()),
    }),
    403: Type.Object({
      message: Type.String(),
      error: Type.Optional(Type.String()),
    }),
    404: Type.Object({
      message: Type.String(),
      error: Type.Optional(Type.String()),
    }),
    500: Type.Object({
      message: Type.String(),
      error: Type.Optional(Type.String()),
    }),
  };
};
