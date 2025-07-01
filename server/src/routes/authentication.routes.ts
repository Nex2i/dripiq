import { FastifyInstance, FastifyRequest, FastifyReply, RouteOptions } from 'fastify';
import { Type } from '@sinclair/typebox';
import { HttpMethods } from '@/utils/HttpMethods';
import { supabase } from '@/libs/supabaseClient';
import { UserService, CreateUserData } from '@/modules/user.service';
import { TenantService } from '@/modules/tenant.service';

const basePath = '/auth';

// Schema for create user endpoint
const createUserBodySchema = Type.Object({
  supabaseId: Type.String(),
  email: Type.String({ format: 'email' }),
  name: Type.Optional(Type.String()),
  avatar: Type.Optional(Type.String()),
});

// Schema for registration endpoint
const registerBodySchema = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 8 }),
  name: Type.String(),
  tenantName: Type.String(),
});

// Define schema for login if you were to implement it fully
// const loginBodySchema = {
//   type: 'object',
//   properties: {
//     email: { type: 'string', format: 'email' },
//     password: { type: 'string' },
//   },
//   required: ['email', 'password'],
// } as const;

export default async function Authentication(fastify: FastifyInstance, _opts: RouteOptions) {
  // Registration route - Complete onboarding flow
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/register`,
    schema: {
      body: registerBodySchema,
      tags: ['Authentication'],
      summary: 'Register User and Tenant',
      description:
        'Complete registration flow: create user in Supabase, create user and tenant in database',
    },
    handler: async (
      request: FastifyRequest<{
        Body: {
          email: string;
          password: string;
          name: string;
          tenantName: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { email, password, name, tenantName } = request.body;

        // Step 1: Create user in Supabase
        const { data: supabaseAuth, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) {
          fastify.log.error(`Supabase signup error: ${signUpError.message}`);
          reply.status(400).send({
            message: 'Failed to create user account',
            error: signUpError.message,
          });
          return;
        }

        if (!supabaseAuth.user) {
          reply.status(400).send({
            message: 'Failed to create user account',
            error: 'No user returned from Supabase',
          });
          return;
        }

        // Step 2: Create tenant in database
        const tenant = await TenantService.createTenant({ name: tenantName });

        // Step 3: Create user in database
        const user = await UserService.createUser({
          supabaseId: supabaseAuth.user.id,
          email,
          name,
        });

        // Step 4: Link user to tenant as super user
        await TenantService.addUserToTenant(user.id, tenant.id, true);

        // Step 5: Sign in the user to get session token
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          fastify.log.error(`Auto sign-in error: ${signInError.message}`);
          // User was created successfully, but auto sign-in failed
          reply.status(201).send({
            message: 'Registration successful. Please log in manually.',
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
            },
            tenant: {
              id: tenant.id,
              name: tenant.name,
            },
          });
          return;
        }

        reply.status(201).send({
          message: 'Registration successful',
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          tenant: {
            id: tenant.id,
            name: tenant.name,
          },
          session: signInData.session,
        });
      } catch (error: any) {
        fastify.log.error(`Registration error: ${error.message}`);
        reply.status(500).send({
          message: 'Failed to complete registration',
          error: error.message,
        });
      }
    },
  });

  // Create User route - Called after successful Supabase signup
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/users`,
    schema: {
      body: createUserBodySchema,
      tags: ['Authentication'],
      summary: 'Create User',
      description: 'Create a new user in the database after Supabase signup',
    },
    handler: async (request: FastifyRequest<{ Body: CreateUserData }>, reply: FastifyReply) => {
      try {
        const userData = request.body;
        const user = await UserService.createUser(userData);
        reply.status(201).send({
          message: 'User created successfully',
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
        });
      } catch (error: any) {
        fastify.log.error(`Error creating user: ${error.message}`);
        reply.status(500).send({
          message: 'Failed to create user',
          error: error.message,
        });
      }
    },
  });

  // Get Current User route - Called after successful login to fetch user data
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}/me`,
    preHandler: [fastify.authPrehandler], // Ensures user is authenticated
    schema: {
      tags: ['Authentication'],
      summary: 'Get Current User',
      description: 'Get the current authenticated user data from database',
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // The user object from Supabase is attached by the authPrehandler
        const supabaseUser = (request as any).user;

        if (!supabaseUser?.id) {
          reply.status(401).send({ message: 'No authenticated user found' });
          return;
        }

        // Fetch user from database using Supabase ID
        const dbUser = await UserService.getUserBySupabaseId(supabaseUser.id);

        if (!dbUser) {
          reply.status(404).send({
            message: 'User not found in database. Please complete signup process.',
          });
          return;
        }

        // Fetch user's tenants
        const userTenants = await TenantService.getUserTenants(dbUser.id);

        reply.send({
          user: {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
            avatar: dbUser.avatar,
            createdAt: dbUser.createdAt,
            updatedAt: dbUser.updatedAt,
          },
          tenants: userTenants.map((ut) => ({
            id: ut.tenant.id,
            name: ut.tenant.name,
            isSuperUser: ut.isSuperUser,
            createdAt: ut.tenant.createdAt,
            updatedAt: ut.tenant.updatedAt,
          })),
          supabaseUser: {
            id: supabaseUser.id,
            email: supabaseUser.email,
            emailConfirmed: supabaseUser.email_confirmed_at !== null,
          },
        });
      } catch (error: any) {
        fastify.log.error(`Error fetching user: ${error.message}`);
        reply.status(500).send({
          message: 'Failed to fetch user data',
          error: error.message,
        });
      }
    },
  });

  // Login route - Client should handle login directly with Supabase for this project.
  // This endpoint can be used if server-side login initiation is ever needed.
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/login`,
    // schema: { // Uncomment and define if you build out this endpoint
    //   body: loginBodySchema,
    //   tags: ['Authentication'],
    //   summary: 'Login',
    //   description: 'Authenticate a user and return a JWT. (Currently informational)',
    // },
    handler: async (_request: FastifyRequest, reply: FastifyReply) => {
      // const { email, password } = request.body as FromSchema<typeof loginBodySchema>;
      // try {
      //   const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      //   if (error) {
      //     reply.status(401).send({ message: 'Login failed', error: error.message });
      //     return;
      //   }
      //   reply.send({ message: 'Login successful', data });
      // } catch (error: any) {
      //   reply.status(500).send({ message: 'Internal server error during login', error: error.message });
      // }
      reply.send({
        message: 'Client handles login directly with Supabase. This endpoint is informational.',
      });
    },
  });

  // Logout route
  fastify.route({
    method: HttpMethods.DELETE,
    url: `${basePath}/logout`,
    preHandler: [fastify.authPrehandler], // Ensures user is authenticated
    schema: {
      tags: ['Authentication'],
      summary: 'Logout',
      description: 'Logout the currently authenticated user.',
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const authHeader = request.headers?.authorization;
      const token = authHeader?.substring('Bearer '.length);

      if (!token) {
        // This should ideally not happen if authPrehandler ran successfully
        reply.status(400).send({ message: 'No token provided for logout.' });
        return;
      }

      try {
        // Verify the token is valid by getting the user
        const {
          data: { user },
          error: getUserError,
        } = await supabase.auth.getUser(token);

        if (getUserError || !user) {
          fastify.log.error(`Error getting user from token: ${getUserError?.message}`);
          reply.status(401).send({ message: 'Invalid token' });
          return;
        }

        // For client-side authentication, we don't need to invalidate the token server-side
        // The client should remove the token from storage upon receiving this response
        // The token will naturally expire based on its TTL
        reply.send({ message: 'Logout successful. Please remove token from client storage.' });
      } catch (error: any) {
        fastify.log.error(`Server error during logout: ${error.message}`);
        reply
          .status(500)
          .send({ message: 'Internal server error during logout', error: error.message });
      }
    },
  });

  // Get Auth Info route
  fastify.route({
    method: HttpMethods.GET,
    url: `${basePath}`,
    preHandler: [fastify.authPrehandler], // Ensures user is authenticated
    schema: {
      tags: ['Authentication'],
      summary: 'Get Auth Info',
      description: 'Get authentication info for the current user.',
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      // The user object is attached by the authPrehandler
      // Ensure your FastifyRequest type is extended to include 'user'
      const user = (request as any).user;
      if (user) {
        reply.send(user);
      } else {
        // This case should ideally be caught by authPrehandler
        reply.status(401).send({ message: 'Unauthorized: No user data found on request.' });
      }
    },
  });

  // Delete User route - Placeholder, not fully implemented
  fastify.route({
    method: HttpMethods.DELETE,
    url: `${basePath}/user/:userId`,
    preHandler: [fastify.authPrehandler], // Protect this route
    schema: {
      tags: ['Authentication'],
      summary: 'Delete User (Not Implemented)',
      description:
        'Delete a user by userId. (This endpoint is not fully implemented and requires admin privileges.)',
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'ID of the user to delete' },
        },
        required: ['userId'],
      },
    },
    handler: async (
      request: FastifyRequest<{ Params: { userId: string } }>,
      reply: FastifyReply
    ) => {
      const { userId } = request.params;
      // IMPORTANT: Deleting a user is a privileged operation.
      // You would need to use the Supabase Admin SDK or a service_role key here,
      // and ensure the calling user has administrative rights.
      // Example: await supabase.auth.admin.deleteUser(userId);
      fastify.log.warn(
        `Attempt to delete user ${userId} - This functionality requires admin privileges and is not fully implemented.`
      );
      reply
        .status(501)
        .send({ message: 'Not Implemented: User deletion requires admin privileges.' });
    },
  });
}
