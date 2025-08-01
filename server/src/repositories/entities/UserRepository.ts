import { eq } from 'drizzle-orm';
import { users, User, NewUser } from '@/db/schema';
import { BaseRepository } from '../base/BaseRepository';

export class UserRepository extends BaseRepository<typeof users, User, NewUser> {
  constructor() {
    super(users);
  }

  /**
   * Find user by Supabase ID
   */
  async findBySupabaseId(supabaseId: string): Promise<User | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.supabaseId, supabaseId))
      .limit(1);
    return results[0];
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.email, email))
      .limit(1);
    return results[0];
  }

  /**
   * Create user with duplicate handling (returns existing user if supabaseId already exists)
   */
  async createWithDuplicateHandling(userData: NewUser): Promise<User> {
    try {
      const [user] = await this.db.insert(this.table).values(userData).returning();
      return user!;
    } catch (error: any) {
      // If user already exists (unique constraint violation), fetch and return it
      if (error.code === '23505') {
        const existingUser = await this.findBySupabaseId(userData.supabaseId);
        if (!existingUser) {
          throw new Error('User creation failed and user not found');
        }
        return existingUser;
      }
      throw error;
    }
  }

  /**
   * Delete user by Supabase ID
   */
  async deleteBySupabaseId(supabaseId: string): Promise<User | undefined> {
    const [result] = await this.db
      .delete(this.table)
      .where(eq(this.table.supabaseId, supabaseId))
      .returning();
    return result;
  }

  /**
   * Update user by Supabase ID
   */
  async updateBySupabaseId(supabaseId: string, data: Partial<NewUser>): Promise<User | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set(data)
      .where(eq(this.table.supabaseId, supabaseId))
      .returning();
    return result;
  }

  /**
   * Check if user exists by Supabase ID
   */
  async existsBySupabaseId(supabaseId: string): Promise<boolean> {
    const result = await this.findBySupabaseId(supabaseId);
    return !!result;
  }

  /**
   * Check if user exists by email
   */
  async existsByEmail(email: string): Promise<boolean> {
    const result = await this.findByEmail(email);
    return !!result;
  }
}
