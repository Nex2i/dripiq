import { eq } from 'drizzle-orm';
import { users, User, NewUser, tenants, userTenants } from '@/db/schema';
import { NotFoundError } from '@/exceptions/error';
import { BaseRepository } from '../base/BaseRepository';

export class UserRepository extends BaseRepository<typeof users, User, NewUser> {
  constructor() {
    super(users);
  }

  /** Get Uswer With Tenant Info For Auth */
  async getUserWithTenantsForAuthBySupabaseId(
    supabaseId: string
  ): Promise<
    { user: User } & { userTenants: { id: string; name: string; isSuperUser: boolean }[] }
  > {
    const result = await this.db
      .select()
      .from(users)
      .leftJoin(userTenants, eq(users.id, userTenants.userId))
      .leftJoin(tenants, eq(userTenants.tenantId, tenants.id))
      .where(eq(users.supabaseId, supabaseId));

    if (!result[0]) {
      throw new NotFoundError(
        `${this.getUserWithTenantsForAuthBySupabaseId.name} - User not found with supabaseId: ${supabaseId}`
      );
    }

    // Reconstruct the user object
    const userRow = result[0]!;
    const user: User = {
      id: userRow.users.id,
      supabaseId: userRow.users.supabaseId,
      calendarLink: userRow.users.calendarLink,
      calendarTieIn: userRow.users.calendarTieIn,
      email: userRow.users.email,
      name: userRow.users.name,
      avatar: userRow.users.avatar,
      createdAt: userRow.users.createdAt,
      updatedAt: userRow.users.updatedAt,
    };

    // Build unique tenants list (filter out null tenants)
    const tenantMap = new Map<string, { id: string; name: string; isSuperUser: boolean }>();

    for (const row of result) {
      if (row.tenants) {
        tenantMap.set(row.tenants.id, {
          id: row.tenants.id,
          name: row.tenants.name,
          isSuperUser: row.user_tenants?.isSuperUser || false,
        });
      }
    }

    return {
      user,
      userTenants: Array.from(tenantMap.values()),
    };
  }

  /**
   * Find user by Supabase ID
   */
  async findBySupabaseId(supabaseId: string): Promise<User> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.supabaseId, supabaseId))
      .limit(1);

    if (!results[0]) {
      throw new NotFoundError(`User not found with supabaseId: ${supabaseId}`);
    }

    return results[0];
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.email, email))
      .limit(1);

    if (!results[0]) {
      throw new NotFoundError(`User not found with email: ${email}`);
    }

    return results[0];
  }

  /**
   * Delete user by Supabase ID
   */
  async deleteBySupabaseId(supabaseId: string): Promise<User> {
    const [result] = await this.db
      .delete(this.table)
      .where(eq(this.table.supabaseId, supabaseId))
      .returning();

    if (!result) {
      throw new NotFoundError(
        `${this.deleteBySupabaseId.name} - User not found with supabaseId: ${supabaseId}`
      );
    }

    return result;
  }

  /**
   * Update user by Supabase ID
   */
  async updateBySupabaseId(supabaseId: string, data: Partial<NewUser>): Promise<User> {
    const [result] = await this.db
      .update(this.table)
      .set(data)
      .where(eq(this.table.supabaseId, supabaseId))
      .returning();

    if (!result) {
      throw new NotFoundError(
        `${this.updateBySupabaseId.name} - User not found with supabaseId: ${supabaseId}`
      );
    }

    return result;
  }
}
