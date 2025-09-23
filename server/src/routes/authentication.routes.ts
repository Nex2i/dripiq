import { FastifyInstance, FastifyRequest, FastifyReply, RouteOptions } from 'fastify';
import { Type } from '@sinclair/typebox';
import { HttpMethods } from '@/utils/HttpMethods';
import { logger } from '@/libs/logger';
import { supabase } from '@/libs/supabase.client';
import { UserService, CreateUserData } from '@/modules/user.service';
import { TenantService } from '@/modules/tenant.service';
import { RoleService } from '@/modules/role.service';
import { authCache } from '@/cache/AuthCacheRedis';
import { DEFAULT_CALENDAR_TIE_IN } from '@/constants';

// Import all authentication schemas from organized schema files
import isFakeMail from '@/libs/isFakeMail.client';
import {
  registerBodySchema,
  registerSuccessResponseSchema,
  createUserBodySchema,
  createUserResponseSchema,
  currentUserResponseSchema,
  logoutResponseSchema,
  errorResponseSchema,
  loginBodySchema,
  sessionInfoResponseSchema,
  verifyOtpBodySchema,
  verifyOtpResponseSchema,
} from './apiSchema/authentication';

const basePath = '/auth';

export default async function Authentication(fastify: FastifyInstance, _opts: RouteOptions) {
  // Registration route - Complete onboarding flow
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/register`,
    schema: {
      body: registerBodySchema,
      response: {
        201: registerSuccessResponseSchema,
        400: errorResponseSchema,
        500: errorResponseSchema,
      },
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

        const isRealEmail = await isFakeMail(email);

        if (!isRealEmail) {
          reply.status(400).send({
            message: 'Invalid email address',
          });
          return;
        }

        // Step 1: Create user in Supabase
        const { data: supabaseAuth, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) {
          logger.error(`Supabase signup error: ${signUpError.message}`);
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

        // Step 4: Get Admin role for the user
        const adminRole = await RoleService.getRoleByName('Admin');

        if (!adminRole) {
          reply.status(500).send({
            message: 'Admin role not found. Please ensure roles are seeded.',
          });
          return;
        }

        // Step 5: Link user to tenant as admin with super user privileges
        await TenantService.addUserToTenant(user.id, tenant.id, adminRole.id, true);

        // Step 6: Sign in the user to get session token
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          logger.error(`Auto sign-in error: ${signInError.message}`);
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
        logger.error(`Registration error: ${error.message}`);
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
      response: {
        201: createUserResponseSchema,
        500: errorResponseSchema,
      },
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
        logger.error(`Error creating user: ${error.message}`);
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
      response: {
        200: currentUserResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
        500: errorResponseSchema,
      },
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
        const dbUser = await UserService.getUserBySupabaseId(supabaseUser.supabaseId);

        if (!dbUser) {
          reply.status(404).send({
            message: 'User not found in database. Please complete signup process.',
          });
          return;
        }

        // Fetch user's tenants with roles
        const userTenants = await TenantService.getUserTenants(dbUser.id);

        // Get role information for each tenant
        const tenantsWithRoles = await Promise.all(
          userTenants.map(async (ut) => {
            const userPermissions = await RoleService.getUserPermissions(dbUser.id, ut.tenant.id);
            return {
              id: ut.tenant.id,
              name: ut.tenant.name,
              isSuperUser: ut.userTenant.isSuperUser,
              role: userPermissions
                ? {
                    id: userPermissions.roleId,
                    name: userPermissions.roleName,
                    permissions: userPermissions.permissions,
                  }
                : null,
              createdAt: ut.tenant.createdAt,
              updatedAt: ut.tenant.updatedAt,
            };
          })
        );

        reply.send({
          user: {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
            avatar: dbUser.avatar,
            calendarLink: dbUser.calendarLink,
            calendarTieIn: dbUser.calendarTieIn || DEFAULT_CALENDAR_TIE_IN,
            createdAt: dbUser.createdAt,
            updatedAt: dbUser.updatedAt,
          },
          tenants: tenantsWithRoles,
          supabaseUser: {
            id: supabaseUser.id,
            email: supabaseUser.email,
            emailConfirmed: supabaseUser.email_confirmed_at !== null,
          },
        });
      } catch (error: any) {
        logger.error(`Error fetching user: ${error.message}`);
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
    schema: {
      body: loginBodySchema,
      response: {
        200: Type.Object({
          message: Type.String(),
        }),
        401: errorResponseSchema,
        500: errorResponseSchema,
      },
      tags: ['Authentication'],
      summary: 'Login',
      description: 'Authenticate a user and return a JWT. (Currently informational)',
    },
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
      response: {
        200: logoutResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        500: errorResponseSchema,
      },
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
          logger.error(`Error getting user from token: ${getUserError?.message}`);
          reply.status(401).send({ message: 'Invalid token' });
          return;
        }

        await authCache.clearToken(token);
        await authCache.clear(user.id);

        // For client-side authentication, we don't need to invalidate the token server-side
        // The client should remove the token from storage upon receiving this response
        // The token will naturally expire based on its TTL
        reply.send({ message: 'Logout successful. Please remove token from client storage.' });
      } catch (error: any) {
        logger.error(`Server error during logout: ${error.message}`);
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
      response: {
        200: sessionInfoResponseSchema,
        401: errorResponseSchema,
      },
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

  // OTP verification route - for email confirmation with OTP
  fastify.route({
    method: HttpMethods.POST,
    url: `${basePath}/verify-otp`,
    schema: {
      body: verifyOtpBodySchema,
      response: {
        200: verifyOtpResponseSchema,
        400: errorResponseSchema,
        500: errorResponseSchema,
      },
      tags: ['Authentication'],
      summary: 'Verify OTP',
      description: 'Verify OTP code sent via email for account confirmation or password reset.',
    },
    handler: async (
      request: FastifyRequest<{
        Body: {
          email: string;
          otp: string;
          type: 'signup' | 'recovery';
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { email, otp, type } = request.body;

        // Verify OTP with Supabase
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token: otp,
          type: type === 'signup' ? 'email' : 'recovery',
        });

        if (error) {
          logger.error(`OTP verification error: ${error.message}`);
          reply.status(400).send({
            message: 'Invalid or expired OTP code',
            error: error.message,
          });
          return;
        }

        if (!data.user) {
          reply.status(400).send({
            message: 'OTP verification failed',
            error: 'No user returned from verification',
          });
          return;
        }

        // Determine redirect URL based on type and current search params
        let redirectUrl = `${process.env.FRONTEND_ORIGIN}/setup-password`;

        // Forward any query params that were passed
        const queryParams = new URLSearchParams();
        if (type === 'signup') {
          queryParams.set('invited', 'true');
        }

        if (queryParams.toString()) {
          redirectUrl += `?${queryParams.toString()}`;
        }

        reply.send({
          message: 'OTP verified successfully',
          redirectUrl,
        });
      } catch (error: any) {
        logger.error(`Error verifying OTP: ${error.message}`);
        reply.status(500).send({
          message: 'Failed to verify OTP',
          error: error.message,
        });
      }
    },
  });
}
