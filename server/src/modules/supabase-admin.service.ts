import { createClient } from '@supabase/supabase-js';

// Create admin client with service role key
// Note: This should use SUPABASE_SERVICE_ROLE_KEY for admin operations
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!, // Fallback for now
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export interface CreateUserData {
  email: string;
  emailConfirm?: boolean;
  metadata?: Record<string, any>;
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
      const result = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        email_confirm: data.emailConfirm || false,
        app_metadata: data.metadata || {},
      });

      if (result.error) {
        throw new Error(`Supabase admin createUser error: ${result.error.message}`);
      }

      return result.data.user;
    } catch (error: any) {
      console.error('Error creating Supabase user:', error);
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
        result = await supabaseAdmin.auth.admin.generateLink({
          type: 'signup',
          email: data.email,
          password: data.password,
          options: {
            redirectTo: data.redirectTo,
          },
        });
      } else {
        result = await supabaseAdmin.auth.admin.generateLink({
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
      console.error('Error generating Supabase link:', error);
      throw error;
    }
  }

  /**
   * Update user metadata
   */
  static async updateUser(userId: string, updates: any): Promise<any> {
    try {
      const result = await supabaseAdmin.auth.admin.updateUserById(userId, updates);

      if (result.error) {
        throw new Error(`Supabase admin updateUser error: ${result.error.message}`);
      }

      return result.data.user;
    } catch (error: any) {
      console.error('Error updating Supabase user:', error);
      throw error;
    }
  }

  /**
   * Delete a user
   */
  static async deleteUser(userId: string): Promise<void> {
    try {
      const result = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (result.error) {
        throw new Error(`Supabase admin deleteUser error: ${result.error.message}`);
      }
    } catch (error: any) {
      console.error('Error deleting Supabase user:', error);
      throw error;
    }
  }
}
