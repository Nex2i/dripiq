import { eq, and, desc } from 'drizzle-orm';
import { db, invites, seats, users, NewInvite, Invite, NewSeat } from '@/db';
import { RoleService } from './role.service';
import { TenantService } from './tenant.service';

export interface CreateInviteData {
  tenantId: string;
  email: string;
  firstName: string;
  lastName?: string;
  role: string; // Accept any role name from database
}

export interface InviteDto {
  email: string;
  firstName: string;
  lastName?: string;
  role: string; // Accept any role name from database
}

export interface UserWithInviteInfo {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: string;
  status: 'pending' | 'active' | 'expired';
  invitedAt?: Date;
  lastLogin?: Date;
  source: 'invite' | 'seat';
}

export class InviteService {
  /**
   * Create a new user invitation
   */
  static async createInvite(
    data: CreateInviteData,
    supabaseId?: string
  ): Promise<{ invite: Invite; token: string }> {
    // Check if email already exists in seats or invites for this tenant
    const [existingSeat, existingInvite] = await Promise.all([
      db
        .select()
        .from(seats)
        .innerJoin(users, eq(seats.supabaseUid, users.supabaseId))
        .where(and(eq(seats.tenantId, data.tenantId), eq(users.email, data.email)))
        .limit(1),
      db
        .select()
        .from(invites)
        .where(
          and(
            eq(invites.tenantId, data.tenantId),
            eq(invites.email, data.email),
            eq(invites.status, 'pending')
          )
        )
        .limit(1),
    ]);

    if (existingSeat.length > 0) {
      throw new Error('User is already a member of this workspace');
    }

    if (existingInvite.length > 0) {
      throw new Error('An invitation is already pending for this email');
    }

    // Create invite
    const newInvite: NewInvite = {
      tenantId: data.tenantId,
      supabaseId: supabaseId || null,
      email: data.email.toLowerCase(),
      firstName: data.firstName,
      lastName: data.lastName || null,
      role: data.role,
      status: 'pending',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };

    const [invite] = await db.insert(invites).values(newInvite).returning();

    if (!invite) {
      throw new Error('Failed to create invitation');
    }

    // Use invite ID as the token
    return { invite, token: invite.id };
  }

  /**
   * Get all users (seats + invites) for a tenant
   */
  static async getTenantUsers(
    tenantId: string,
    page = 1,
    limit = 25
  ): Promise<{
    users: UserWithInviteInfo[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const offset = (page - 1) * limit;

    // Get active users (seats)
    const activeUsersQuery = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: seats.role,
        createdAt: seats.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(seats)
      .innerJoin(users, eq(seats.supabaseUid, users.supabaseId))
      .where(eq(seats.tenantId, tenantId))
      .orderBy(desc(seats.createdAt));

    // Get pending invitations
    const pendingInvitesQuery = await db
      .select({
        id: invites.id,
        firstName: invites.firstName,
        lastName: invites.lastName,
        email: invites.email,
        role: invites.role,
        status: invites.status,
        createdAt: invites.createdAt,
      })
      .from(invites)
      .where(eq(invites.tenantId, tenantId))
      .orderBy(desc(invites.createdAt));

    // Transform active users
    const activeUsers: UserWithInviteInfo[] = activeUsersQuery.map((user) => ({
      id: user.id,
      firstName: user.name || undefined, // Split this properly if name contains first/last
      lastName: undefined, // We'll need to modify schema or handle name splitting
      email: user.email,
      role: user.role,
      status: 'active' as const,
      invitedAt: user.createdAt,
      lastLogin: user.updatedAt,
      source: 'seat' as const,
    }));

    // Transform pending invites
    const pendingInvites: UserWithInviteInfo[] = pendingInvitesQuery.map((invite) => ({
      id: invite.id,
      firstName: invite.firstName || undefined,
      lastName: invite.lastName || undefined,
      email: invite.email,
      role: invite.role,
      status: invite.status as 'pending' | 'active' | 'expired',
      invitedAt: invite.createdAt,
      lastLogin: undefined,
      source: 'invite' as const,
    }));

    // Combine and sort
    const allUsers: UserWithInviteInfo[] = [...activeUsers, ...pendingInvites].sort((a, b) => {
      // Sort by status (pending first), then by role (alphabetically), then by email
      if (a.status !== b.status) {
        const statusOrder = { pending: 0, expired: 1, active: 2 };
        return statusOrder[a.status] - statusOrder[b.status];
      }
      if (a.role !== b.role) {
        // Sort roles alphabetically (Admin comes before Sales)
        return a.role.localeCompare(b.role);
      }
      return a.email.localeCompare(b.email);
    });

    // Apply pagination
    const paginatedUsers = allUsers.slice(offset, offset + limit);
    const total = allUsers.length;
    const totalPages = Math.ceil(total / limit);

    return {
      users: paginatedUsers,
      total,
      page,
      totalPages,
    };
  }

  /**
   * Verify invitation token (using invite ID)
   */
  static async verifyInviteToken(token: string): Promise<Invite | null> {
    const [invite] = await db
      .select()
      .from(invites)
      .where(and(eq(invites.id, token), eq(invites.status, 'pending')))
      .limit(1);

    if (!invite || invite.expiresAt < new Date()) {
      return null;
    }

    return invite;
  }

  /**
   * Accept invitation
   */
  static async acceptInvite(token: string): Promise<{ invite: Invite; seat: any }> {
    const invite = await this.verifyInviteToken(token);

    if (!invite) {
      throw new Error('Invalid or expired invitation token');
    }

    // Check if user already has a seat in this tenant
    const existingSeat = await db
      .select()
      .from(seats)
      .where(and(eq(seats.tenantId, invite.tenantId)))
      .limit(1);

    if (existingSeat.length > 0) {
      throw new Error('User is already a member of this workspace');
    }

    // Update invite status
    const [updatedInvite] = await db
      .update(invites)
      .set({
        status: 'accepted',
        acceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(invites.id, invite.id))
      .returning();

    // Ensure supabaseId exists
    if (!invite.supabaseId) {
      throw new Error('Invalid invitation: missing supabase ID');
    }

    // Create user in our database if they don't exist
    const { UserService } = await import('@/modules/user.service');
    let user = await UserService.getUserBySupabaseId(invite.supabaseId);

    if (!user) {
      // Create the user in our database
      const fullName = invite.lastName
        ? `${invite.firstName} ${invite.lastName}`
        : invite.firstName;

      user = await UserService.createUser({
        supabaseId: invite.supabaseId,
        email: invite.email,
        name: fullName,
      });
    }

    // Get the role ID from the role name
    const role = await RoleService.getRoleByName(invite.role);
    if (!role) {
      throw new Error(`Invalid role specified: ${invite.role}`);
    }

    // Add user to tenant (this creates the user_tenants relationship)
    await TenantService.addUserToTenant(user.id, invite.tenantId, role.id, false);

    // Create seat (for workspace-specific permissions)
    const newSeat: NewSeat = {
      tenantId: invite.tenantId,
      supabaseUid: invite.supabaseId,
      role: invite.role,
    };

    const [seat] = await db.insert(seats).values(newSeat).returning();

    if (!seat) {
      throw new Error('Failed to create user seat');
    }

    return { invite: updatedInvite!, seat };
  }

  /**
   * Resend invitation
   */
  static async resendInvite(inviteId: string): Promise<{ invite: Invite; token: string }> {
    const invite = await db.select().from(invites).where(eq(invites.id, inviteId)).limit(1);

    if (!invite.length || invite[0]!.status !== 'pending') {
      throw new Error('Invitation not found or not pending');
    }

    // Update invite with extended expiry
    const [updatedInvite] = await db
      .update(invites)
      .set({
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        updatedAt: new Date(),
      })
      .where(eq(invites.id, inviteId))
      .returning();

    // Return invite ID as token
    return { invite: updatedInvite!, token: inviteId };
  }

  /**
   * Revoke invitation
   */
  static async revokeInvite(inviteId: string): Promise<Invite> {
    const [revokedInvite] = await db
      .update(invites)
      .set({
        status: 'expired',
        updatedAt: new Date(),
      })
      .where(eq(invites.id, inviteId))
      .returning();

    if (!revokedInvite) {
      throw new Error('Invitation not found');
    }

    return revokedInvite;
  }

  /**
   * Mark expired invitations
   */
  static async markExpiredInvites(): Promise<number> {
    const result = await db
      .update(invites)
      .set({
        status: 'expired',
        updatedAt: new Date(),
      })
      .where(and(eq(invites.status, 'pending'), eq(invites.expiresAt, invites.expiresAt)))
      .returning({ id: invites.id });

    return result.length;
  }

  /**
   * Get invitation by ID
   */
  static async getInviteById(inviteId: string): Promise<Invite | null> {
    const result = await db.select().from(invites).where(eq(invites.id, inviteId)).limit(1);
    return result[0] || null;
  }

  /**
   * Update invitation with Supabase user ID
   */
  static async updateInviteWithSupabaseId(inviteId: string, supabaseId: string): Promise<Invite> {
    const [updatedInvite] = await db
      .update(invites)
      .set({
        supabaseId: supabaseId,
        updatedAt: new Date(),
      })
      .where(eq(invites.id, inviteId))
      .returning();

    if (!updatedInvite) {
      throw new Error('Invitation not found');
    }

    return updatedInvite;
  }
}
