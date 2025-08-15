import { supabase } from '@/libs/supabase.client';
import { logger } from '@/libs/logger';

export interface CreateUserData {
  email: string;
  emailConfirm?: boolean;
  metadata?: Record<string, any>;
}

export interface InviteUserData {
  email: string;
  redirectTo?: string;
  data?: Record<string, any>;
}

export interface GenerateLinkData {
  type: 'signup' | 'recovery';
  email: string;
  redirectTo?: string;
  password?: string; // Required for signup type
}

export class SupabaseAdminService {
  /**
   * Create a new user in Supabase (disabled by default for invites)
   */
  static async createUser(data: CreateUserData): Promise<any> {
    try {
      const result = await supabase.auth.admin.createUser({
        email: data.email,
        email_confirm: true,
        app_metadata: data.metadata || {},
      });

      if (result.error) {
        throw new Error(`Supabase admin createUser error: ${result.error.message}`);
      }

      return result.data.user;
    } catch (error: any) {
      logger.error('Error creating Supabase user', error);
      throw error;
    }
  }

  /**
   * Generate a magic link for user signup/password reset
   */
  static async generateLink(data: GenerateLinkData): Promise<string> {
    try {
      let result: any;

      if (data.type === 'signup') {
        if (!data.password) {
          throw new Error('Password is required for signup links');
        }
        result = await supabase.auth.admin.generateLink({
          type: 'signup',
          email: data.email,
          password: data.password,
          options: {
            redirectTo: data.redirectTo,
          },
        });
      } else {
        result = await supabase.auth.admin.generateLink({
          type: 'recovery',
          email: data.email,
          options: {
            redirectTo: data.redirectTo,
          },
        });
      }

      if (result.error) {
        throw new Error(`Supabase admin generateLink error: ${result.error.message}`);
      }

      return result.data.properties?.action_link || '';
    } catch (error: any) {
      logger.error('Error generating Supabase link', error);
      throw error;
    }
  }

  /**
   * Update user metadata
   */
  static async updateUser(userId: string, updates: any): Promise<any> {
    try {
      const result = await supabase.auth.admin.updateUserById(userId, updates);

      if (result.error) {
        throw new Error(`Supabase admin updateUser error: ${result.error.message}`);
      }

      return result.data.user;
    } catch (error: any) {
      logger.error('Error updating Supabase user', error);
      throw error;
    }
  }

  /**
   * Get user by email
   */
  static async getUserByEmail(email: string): Promise<any> {
    try {
      const result = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000, // Adjust as needed
      });

      if (result.error) {
        throw new Error(`Supabase admin listUsers error: ${result.error.message}`);
      }

      // Find user with matching email
      const user = result.data.users.find((user) => user.email === email);
      return user || null;
    } catch (error: any) {
      logger.error('Error getting Supabase user by email', error);
      throw error;
    }
  }

  /**
   * Delete a user
   */
  static async deleteUser(userId: string): Promise<void> {
    try {
      const result = await supabase.auth.admin.deleteUser(userId);

      if (result.error) {
        throw new Error(`Supabase admin deleteUser error: ${result.error.message}`);
      }
    } catch (error: any) {
      logger.error('Error deleting Supabase user', error);
      throw error;
    }
  }

  /**
   * Invite a user by email using Supabase's built-in invite functionality
   * This will create the user and send an invite email automatically
   */
  static async inviteUserByEmail(data: InviteUserData): Promise<any> {
    try {
      const result = await supabase.auth.admin.inviteUserByEmail(data.email, {
        redirectTo: data.redirectTo,
        data: data.data || {},
      });

      if (result.error) {
        throw new Error(`Supabase admin inviteUserByEmail error: ${result.error.message}`);
      }

      return result.data.user;
    } catch (error: any) {
      logger.error('Error inviting user via Supabase', error);
      throw error;
    }
  }

  static async resendInvite(data: InviteUserData): Promise<any> {
    try {
      const result = await supabase.auth.signInWithOtp({
        email: data.email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: data.redirectTo,
          data: data.data || {},
        },
      });

      if (result.error) {
        throw new Error(`Supabase admin resendInvite error: ${result.error.message}`);
      }

      return result.data.user;
    } catch (error: any) {
      logger.error('Error resending invite via Supabase', error);
      throw error;
    }
  }
}
