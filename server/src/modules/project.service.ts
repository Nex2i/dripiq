import { PrismaClient, Project, ProjectPermission } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateProjectData {
  name: string;
  description?: string;
  tenantId: string;
  createdByUserId: string;
}

export interface ProjectWithPermissions extends Project {
  permissions: ProjectPermission[];
  users: {
    userId: string;
    permissions: ProjectPermission[];
  }[];
}

export class ProjectService {
  /**
   * Create a new project and assign the creator as the project owner
   */
  static async createProject(data: CreateProjectData): Promise<Project> {
    try {
      const project = await prisma.project.create({
        data: {
          name: data.name,
          description: data.description,
          tenantId: data.tenantId,
          users: {
            create: {
              userId: data.createdByUserId,
              permissions: [
                ProjectPermission.VIEW,
                ProjectPermission.EDIT,
                ProjectPermission.DELETE,
                ProjectPermission.MANAGE_USERS,
                ProjectPermission.MANAGE_SETTINGS,
              ],
            },
          },
        },
        include: {
          users: true,
          tenant: true,
        },
      });

      return project;
    } catch (error: any) {
      throw new Error(`Failed to create project: ${error.message}`);
    }
  }

  /**
   * Get all projects that a user has read access to
   */
  static async getUserProjects(userId: string): Promise<ProjectWithPermissions[]> {
    try {
      // Get projects where the user has any permission (which includes VIEW)
      const projectUsers = await prisma.projectUser.findMany({
        where: {
          userId: userId,
          permissions: {
            has: ProjectPermission.VIEW,
          },
        },
        include: {
          project: {
            include: {
              tenant: true,
              users: {
                select: {
                  userId: true,
                  permissions: true,
                },
              },
            },
          },
        },
      });

      // Transform the data to include user permissions
      const projects: ProjectWithPermissions[] = projectUsers.map((pu) => ({
        ...pu.project,
        permissions: pu.permissions,
        users: pu.project.users,
      }));

      return projects;
    } catch (error: any) {
      throw new Error(`Failed to fetch user projects: ${error.message}`);
    }
  }

  /**
   * Get a specific project if user has read access
   */
  static async getProjectById(
    projectId: string,
    userId: string
  ): Promise<ProjectWithPermissions | null> {
    try {
      const projectUser = await prisma.projectUser.findUnique({
        where: {
          userId_projectId: {
            userId: userId,
            projectId: projectId,
          },
          permissions: {
            has: ProjectPermission.VIEW,
          },
        },
        include: {
          project: {
            include: {
              tenant: true,
              users: {
                select: {
                  userId: true,
                  permissions: true,
                },
              },
            },
          },
        },
      });

      if (!projectUser) {
        return null;
      }

      return {
        ...projectUser.project,
        permissions: projectUser.permissions,
        users: projectUser.project.users,
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch project: ${error.message}`);
    }
  }

  /**
   * Add a user to a project with specific permissions
   */
  static async addUserToProject(
    projectId: string,
    userId: string,
    permissions: ProjectPermission[]
  ): Promise<void> {
    try {
      await prisma.projectUser.create({
        data: {
          projectId,
          userId,
          permissions,
        },
      });
    } catch (error: any) {
      throw new Error(`Failed to add user to project: ${error.message}`);
    }
  }

  /**
   * Update project permissions for a user
   */
  static async updateUserProjectPermissions(
    projectId: string,
    userId: string,
    permissions: ProjectPermission[]
  ): Promise<void> {
    try {
      await prisma.projectUser.update({
        where: {
          userId_projectId: {
            userId,
            projectId,
          },
        },
        data: {
          permissions,
        },
      });
    } catch (error: any) {
      throw new Error(`Failed to update user project permissions: ${error.message}`);
    }
  }

  /**
   * Remove a user from a project
   */
  static async removeUserFromProject(projectId: string, userId: string): Promise<void> {
    try {
      await prisma.projectUser.delete({
        where: {
          userId_projectId: {
            userId,
            projectId,
          },
        },
      });
    } catch (error: any) {
      throw new Error(`Failed to remove user from project: ${error.message}`);
    }
  }

  /**
   * Delete a project (only if user has DELETE permission)
   */
  static async deleteProject(projectId: string, userId: string): Promise<void> {
    try {
      // Check if user has DELETE permission
      const projectUser = await prisma.projectUser.findUnique({
        where: {
          userId_projectId: {
            userId,
            projectId,
          },
          permissions: {
            has: ProjectPermission.DELETE,
          },
        },
      });

      if (!projectUser) {
        throw new Error('User does not have permission to delete this project');
      }

      // Delete the project (cascade will handle ProjectUser records)
      await prisma.project.delete({
        where: {
          id: projectId,
        },
      });
    } catch (error: any) {
      throw new Error(`Failed to delete project: ${error.message}`);
    }
  }

  /**
   * Get detailed project structure with directories and prompts up to specified depth
   */
  static async getProjectDetails(
    projectId: string,
    userId: string,
    maxDepth: number = 4
  ): Promise<any | null> {
    try {
      // First check if user has access to the project
      const projectUser = await prisma.projectUser.findUnique({
        where: {
          userId_projectId: {
            userId: userId,
            projectId: projectId,
          },
          permissions: {
            has: ProjectPermission.VIEW,
          },
        },
        include: {
          project: {
            include: {
              tenant: true,
              users: {
                select: {
                  userId: true,
                  permissions: true,
                },
              },
            },
          },
        },
      });

      if (!projectUser) {
        return null;
      }

      // Get all directories for this project
      const directories = await prisma.directory.findMany({
        where: {
          projectId: projectId,
        },
        include: {
          prompts: {
            select: {
              id: true,
              name: true,
              description: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
        orderBy: [
          { isRoot: 'desc' }, // Root directories first
          { name: 'asc' },
        ],
      });

      // Build hierarchical structure with depth limit
      const buildHierarchy = (parentId: string | null, currentDepth: number = 0): any[] => {
        if (currentDepth >= maxDepth) {
          return [];
        }

        const children = directories
          .filter((dir) => dir.parentId === parentId)
          .map((dir) => ({
            id: dir.id,
            name: dir.name,
            description: dir.description,
            isRoot: dir.isRoot,
            type: 'directory' as const,
            createdAt: dir.createdAt.toISOString(),
            updatedAt: dir.updatedAt.toISOString(),
            children: buildHierarchy(dir.id, currentDepth + 1),
            prompts: dir.prompts.map((prompt) => ({
              id: prompt.id,
              name: prompt.name,
              description: prompt.description,
              type: 'prompt' as const,
              createdAt: prompt.createdAt.toISOString(),
              updatedAt: prompt.updatedAt.toISOString(),
            })),
          }));

        return children;
      };

      const directoryHierarchy = buildHierarchy(null);

      return {
        ...projectUser.project,
        permissions: projectUser.permissions,
        directories: directoryHierarchy,
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch project details: ${error.message}`);
    }
  }

  /**
   * Create a new directory in a project
   */
  static async createDirectory(
    projectId: string,
    userId: string,
    data: {
      name: string;
      description?: string;
      parentId?: string;
    }
  ): Promise<any | null> {
    try {
      // Check if user has edit permissions
      const projectUser = await prisma.projectUser.findUnique({
        where: {
          userId_projectId: {
            userId: userId,
            projectId: projectId,
          },
          permissions: {
            has: ProjectPermission.EDIT,
          },
        },
      });

      if (!projectUser) {
        throw new Error('No permission to create directory in this project');
      }

      // If parentId is provided, verify it exists and belongs to this project
      if (data.parentId) {
        const parentDirectory = await prisma.directory.findFirst({
          where: {
            id: data.parentId,
            projectId: projectId,
          },
        });

        if (!parentDirectory) {
          throw new Error('Parent directory not found or does not belong to this project');
        }
      }

      // Create the directory
      const directory = await prisma.directory.create({
        data: {
          name: data.name,
          description: data.description,
          projectId: projectId,
          parentId: data.parentId || null,
          isRoot: !data.parentId, // Root if no parent
        },
      });

      return {
        id: directory.id,
        name: directory.name,
        description: directory.description,
        isRoot: directory.isRoot,
        type: 'directory' as const,
        createdAt: directory.createdAt.toISOString(),
        updatedAt: directory.updatedAt.toISOString(),
        children: [],
        prompts: [],
      };
    } catch (error: any) {
      throw new Error(`Failed to create directory: ${error.message}`);
    }
  }

  /**
   * Create a new prompt in a directory
   */
  static async createPrompt(
    projectId: string,
    userId: string,
    data: {
      name: string;
      description?: string;
      directoryId: string;
    }
  ): Promise<any | null> {
    try {
      // Check if user has edit permissions
      const projectUser = await prisma.projectUser.findUnique({
        where: {
          userId_projectId: {
            userId: userId,
            projectId: projectId,
          },
          permissions: {
            has: ProjectPermission.EDIT,
          },
        },
      });

      if (!projectUser) {
        throw new Error('No permission to create prompt in this project');
      }

      // Verify the directory exists and belongs to this project
      const directory = await prisma.directory.findFirst({
        where: {
          id: data.directoryId,
          projectId: projectId,
        },
      });

      if (!directory) {
        throw new Error('Directory not found or does not belong to this project');
      }

      // Create the prompt
      const prompt = await prisma.prompt.create({
        data: {
          name: data.name,
          description: data.description,
          directoryId: data.directoryId,
        },
      });

      return {
        id: prompt.id,
        name: prompt.name,
        description: prompt.description,
        type: 'prompt' as const,
        createdAt: prompt.createdAt.toISOString(),
        updatedAt: prompt.updatedAt.toISOString(),
      };
    } catch (error: any) {
      throw new Error(`Failed to create prompt: ${error.message}`);
    }
  }

  /**
   * Get all directories in a project (flat list for dropdown selection)
   */
  static async getProjectDirectories(projectId: string, userId: string): Promise<any[]> {
    try {
      // Check if user has view permissions
      const projectUser = await prisma.projectUser.findUnique({
        where: {
          userId_projectId: {
            userId: userId,
            projectId: projectId,
          },
          permissions: {
            has: ProjectPermission.VIEW,
          },
        },
      });

      if (!projectUser) {
        return [];
      }

      // Get all directories for this project
      const directories = await prisma.directory.findMany({
        where: {
          projectId: projectId,
        },
        orderBy: [{ isRoot: 'desc' }, { name: 'asc' }],
      });

      return directories.map((dir) => ({
        id: dir.id,
        name: dir.name,
        description: dir.description,
        isRoot: dir.isRoot,
        parentId: dir.parentId,
      }));
    } catch (error: any) {
      throw new Error(`Failed to fetch project directories: ${error.message}`);
    }
  }

  /**
   * Get directory with full content details
   */
  static async getDirectoryDetails(directoryId: string, userId: string): Promise<any | null> {
    try {
      // Get directory with project info to check permissions
      const directory = await prisma.directory.findUnique({
        where: {
          id: directoryId,
        },
        include: {
          project: {
            include: {
              users: {
                where: {
                  userId: userId,
                  permissions: {
                    has: ProjectPermission.VIEW,
                  },
                },
              },
            },
          },
          prompts: true,
          children: true,
        },
      });

      if (!directory || directory.project.users.length === 0) {
        return null;
      }

      return {
        id: directory.id,
        name: directory.name,
        description: directory.description,
        isRoot: directory.isRoot,
        type: 'directory' as const,
        createdAt: directory.createdAt.toISOString(),
        updatedAt: directory.updatedAt.toISOString(),
        children: directory.children.map((child) => ({
          id: child.id,
          name: child.name,
          description: child.description,
          isRoot: child.isRoot,
          type: 'directory' as const,
          createdAt: child.createdAt.toISOString(),
          updatedAt: child.updatedAt.toISOString(),
        })),
        prompts: directory.prompts.map((prompt) => ({
          id: prompt.id,
          name: prompt.name,
          description: prompt.description,
          type: 'prompt' as const,
          createdAt: prompt.createdAt.toISOString(),
          updatedAt: prompt.updatedAt.toISOString(),
        })),
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch directory details: ${error.message}`);
    }
  }

  /**
   * Get prompt with full details including content
   */
  static async getPromptDetails(promptId: string, userId: string): Promise<any | null> {
    try {
      // Get prompt with directory and project info to check permissions
      const prompt = await prisma.prompt.findUnique({
        where: {
          id: promptId,
        },
        include: {
          directory: {
            include: {
              project: {
                include: {
                  users: {
                    where: {
                      userId: userId,
                      permissions: {
                        has: ProjectPermission.VIEW,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!prompt || prompt.directory.project.users.length === 0) {
        return null;
      }

      return {
        id: prompt.id,
        name: prompt.name,
        description: prompt.description,
        type: 'prompt' as const,
        createdAt: prompt.createdAt.toISOString(),
        updatedAt: prompt.updatedAt.toISOString(),
        directoryId: prompt.directoryId,
        directoryName: prompt.directory.name,
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch prompt details: ${error.message}`);
    }
  }
}
