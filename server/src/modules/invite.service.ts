import { randomBytes } from 'crypto';
import { eq, and, desc } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { db, invites, seats, users, NewInvite, Invite, NewSeat } from '@/db';

export interface CreateInviteData {
  tenantId: string;
  email: string;
  firstName: string;
  lastName?: string;
  role: 'owner' | 'manager' | 'rep';
  dailyCap?: number;
}

export interface InviteDto {
  email: string;
  firstName: string;
  lastName?: string;
  role: 'owner' | 'manager' | 'rep';
  dailyCap?: number;
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
  static async createInvite(data: CreateInviteData): Promise<{ invite: Invite; token: string }> {
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

    // Generate secure token
    const token = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(token, 12);

    // Create invite
    const newInvite: NewInvite = {
      tenantId: data.tenantId,
      email: data.email.toLowerCase(),
      firstName: data.firstName,
      lastName: data.lastName || null,
      role: data.role,
      dailyCap: (data.dailyCap || 200).toString(),
      tokenHash,
      status: 'pending',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };

    const [invite] = await db.insert(invites).values(newInvite).returning();

    if (!invite) {
      throw new Error('Failed to create invitation');
    }

    return { invite, token };
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
      // Sort by status (pending first), then by role, then by email
      if (a.status !== b.status) {
        const statusOrder = { pending: 0, expired: 1, active: 2 };
        return statusOrder[a.status] - statusOrder[b.status];
      }
      if (a.role !== b.role) {
        const roleOrder = { owner: 0, manager: 1, rep: 2 };
        return (
          roleOrder[a.role as keyof typeof roleOrder] - roleOrder[b.role as keyof typeof roleOrder]
        );
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
   * Verify invitation token
   */
  static async verifyInviteToken(token: string): Promise<Invite | null> {
    const allInvites = await db
      .select()
      .from(invites)
      .where(and(eq(invites.status, 'pending'), eq(invites.expiresAt, invites.expiresAt)));

    for (const invite of allInvites) {
      const isValid = await bcrypt.compare(token, invite.tokenHash);
      if (isValid && invite.expiresAt > new Date()) {
        return invite;
      }
    }

    return null;
  }

  /**
   * Accept invitation
   */
  static async acceptInvite(
    token: string,
    supabaseUserId: string
  ): Promise<{ invite: Invite; seat: any }> {
    const invite = await this.verifyInviteToken(token);

    if (!invite) {
      throw new Error('Invalid or expired invitation token');
    }

    // Check if user already has a seat in this tenant
    const existingSeat = await db
      .select()
      .from(seats)
      .where(and(eq(seats.tenantId, invite.tenantId), eq(seats.supabaseUid, supabaseUserId)))
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

    // Create seat
    const newSeat: NewSeat = {
      tenantId: invite.tenantId,
      supabaseUid: supabaseUserId,
      role: invite.role,
      dailyCap: invite.dailyCap,
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

    // Generate new token
    const token = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(token, 12);

    // Update invite with new token and extend expiry
    const [updatedInvite] = await db
      .update(invites)
      .set({
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        updatedAt: new Date(),
      })
      .where(eq(invites.id, inviteId))
      .returning();

    return { invite: updatedInvite!, token };
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
}
