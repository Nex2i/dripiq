import { FastifyInstance, FastifyRequest, FastifyReply, RouteOptions } from 'fastify';
import { Type } from '@sinclair/typebox';
import { HttpMethods } from '@/utils/HttpMethods';
import { AuthenticatedRequest } from '@/plugins/authentication.plugin';
import { storageService } from '@/modules/storage/storage.service';

const basePath = '/logo';

// Schema for logo upload request
const logoUploadBodySchema = Type.Object({
  domain: Type.String({ description: 'Website domain (e.g., example.com)' }),
  contentType: Type.String({ description: 'MIME type of the image (e.g., image/png, image/jpeg)' }),
});

// Schema for logo upload response
const logoUploadResponseSchema = Type.Object({
  signedUploadUrl: Type.String({ description: 'Signed URL for uploading the logo' }),
  publicUrl: Type.String({ description: 'Public URL of the uploaded logo' }),
});

export default async function LogoRoutes(fastify: FastifyInstance, _opts: RouteOptions) {
  // Generate signed upload URL for logo
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/upload`,
    preHandler: [fastify.authPrehandler],
    schema: {
      body: logoUploadBodySchema,
      tags: ['Logo'],
      summary: 'Get Signed Upload URL for Logo',
      description: 'Generate a signed upload URL for uploading a logo to Supabase storage',
      response: {
        200: logoUploadResponseSchema,
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
        500: Type.Object({
          message: Type.String(),
          error: Type.Optional(Type.String()),
        }),
      },
    },
    handler: async (
      request: FastifyRequest<{
        Body: {
          domain: string;
          contentType: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const authenticatedRequest = request as AuthenticatedRequest;
        const { domain } = request.body;

        try {
          const storagePath = storageService.getTenantDomainLogoKey(
            authenticatedRequest.tenantId,
            domain
          );
          const signedUrl = await storageService.getUploadSigned(storagePath);
          const publicUrl = await storageService.getSignedUrl(storagePath);

          reply.send({
            signedUploadUrl: signedUrl,
            publicUrl: publicUrl,
          });
        } catch (_urlError) {
          return reply.status(400).send({
            message: 'Invalid domain format',
            error: 'Domain must be a valid URL or hostname',
          });
        }
      } catch (error: any) {
        fastify.log.error(`Error generating logo upload URL: ${error.message}`);

        if (
          error.message?.includes('access to tenant') ||
          error.message?.includes('ForbiddenError')
        ) {
          return reply.status(403).send({
            message: 'Access denied to tenant resources',
            error: error.message,
          });
        }

        return reply.status(500).send({
          message: 'Failed to generate upload URL',
          error: error.message,
        });
      }
    },
  });
}
