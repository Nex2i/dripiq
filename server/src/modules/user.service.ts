import { User } from '@prisma/client';
import prisma from '@/libs/prismaClient';

export interface CreateUserData {
  supabaseId: string;
  email: string;
  name?: string;
  avatar?: string;
}

export class UserService {
  /**
   * Create a new user in the database
   */
  static async createUser(userData: CreateUserData): Promise<User> {
    try {
      const user = await prisma.user.create({
        data: {
          supabaseId: userData.supabaseId,
          email: userData.email,
          name: userData.name || null,
          avatar: userData.avatar || null,
        },
      });
      return user;
    } catch (error: any) {
      // If user already exists, fetch and return it
      if (error.code === 'P2002') {
        const existingUser = await prisma.user.findUniqueOrThrow({
          where: { supabaseId: userData.supabaseId },
        });
        return existingUser;
      }
      throw error;
    }
  }

  /**
   * Get user by Supabase ID
   */
  static async getUserBySupabaseId(supabaseId: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { supabaseId },
    });
  }

  /**
   * Get user by email
   */
  static async getUserByEmail(email: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Update user data
   */
  static async updateUser(supabaseId: string, updateData: Partial<CreateUserData>): Promise<User> {
    return await prisma.user.update({
      where: { supabaseId },
      data: updateData,
    });
  }

  /**
   * Delete user
   */
  static async deleteUser(supabaseId: string): Promise<User> {
    return await prisma.user.delete({
      where: { supabaseId },
    });
  }
}
