import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { ForbiddenError } from '@/exceptions/error'; // Assuming this is a custom error class
import { logger } from '@/libs/logger'; // Assuming this is your logger
import { supabase } from '@/libs/supabaseClient'; // Import the server-side Supabase client

export default fastifyPlugin(async (fastify: FastifyInstance) => {
  const authPrehandler = async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      const authHeader = request.headers?.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new ForbiddenError(
          'No or invalid Authorization Header format. Expected Bearer token.'
        );
      }

      const token = authHeader.substring('Bearer '.length);

      if (!token) {
        throw new ForbiddenError('No token provided in Authorization Header.');
      }

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (error) {
        logger.warn(`Supabase auth.getUser error: ${error.message}`, {
          authHeader: request.headers?.authorization, // Log only a part or a masked version in production
          requestUrl: request.url,
        });
        // Distinguish between different types of errors if needed, e.g., token expired vs. invalid token
        throw new ForbiddenError(`Invalid Token: ${error.message}`);
      }

      if (!user) {
        // This case might be redundant if error is always set when user is null, but good for safety
        throw new ForbiddenError('Invalid Token: User not found for token.');
      }

      // Attach user information to the request object
      // Ensure your FastifyRequest interface is extended to include 'user'
      // (as seen in the original file, it was expected to be `request.user = payload.user;`)
      (request as any).user = user; // Using 'as any' for now, proper type extension is better
    } catch (error: any) {
      // Log the error with more details
      logger.warn(`authPrehandler Error: ${error.message || 'Unknown auth error'}`, {
        error: error instanceof Error ? error.stack : JSON.stringify(error),
        requestUrl: request.url,
        // Avoid logging sensitive parts of authHeader in production directly
        authHeaderProvided: !!request.headers?.authorization,
      });

      // Ensure reply is sent for errors thrown by the prehandler
      // The 'ForbiddenError' should ideally be handled by a global error handler
      // that sets the correct status code. If not, set it here.
      const errorMessage = error.message || 'Authentication failed.';

      // If a global error handler is configured to catch these and send replies,
      // re-throwing might be enough. Otherwise, explicitly send reply.
      // For now, let's assume a global handler will catch and reply.
      if (error instanceof ForbiddenError) {
        throw error; // Re-throw custom error to be caught by global error handler
      } else {
        // For unexpected errors, wrap them or throw a generic ForbiddenError
        throw new ForbiddenError(errorMessage);
      }
    }
  };

  fastify.decorate('authPrehandler', authPrehandler);
});
