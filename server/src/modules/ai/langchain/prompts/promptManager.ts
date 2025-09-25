import { createLangfuseClient } from '../config/langfuse.config';
import { logger } from '@/libs/logger';

// Define prompt types and their metadata
export interface PromptVersion {
  id: string;
  name: string;
  version: number;
  content: string;
  description?: string;
  variables: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PromptExecution {
  promptName: string;
  promptVersion: number;
  variables: Record<string, string>;
  executionTime: number;
  success: boolean;
  error?: string;
  outputLength?: number;
}

export class PromptManager {
  private static instance: PromptManager;
  private langfuseClient = createLangfuseClient();
  private promptCache = new Map<string, PromptVersion>();

  private constructor() {}

  static getInstance(): PromptManager {
    if (!PromptManager.instance) {
      PromptManager.instance = new PromptManager();
    }
    return PromptManager.instance;
  }

  /**
   * Get a prompt by name and inject variables
   */
  async getPrompt(promptName: string, variables: Record<string, string> = {}): Promise<string> {
    const promptVersion = await this.getPromptVersion(promptName);

    if (!promptVersion) {
      throw new Error(`Prompt '${promptName}' not found`);
    }

    // Track prompt execution in LangFuse
    const startTime = Date.now();

    try {
      const processedPrompt = this.injectVariables(promptVersion.content, variables);

      const executionTime = Date.now() - startTime;

      // Log prompt execution to LangFuse
      this.langfuseClient?.event({
        name: 'prompt-execution',
        input: {
          promptName,
          promptVersion: promptVersion.version,
          variables: Object.keys(variables),
          variableValues: variables,
        },
        output: {
          success: true,
          executionTime,
          outputLength: processedPrompt.length,
          promptContent: processedPrompt.substring(0, 500), // Truncate for readability
        },
        metadata: {
          type: 'prompt-execution',
          version: promptVersion.version,
        },
      });

      return processedPrompt;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.langfuseClient?.event({
        name: 'prompt-execution-error',
        input: {
          promptName,
          promptVersion: promptVersion.version,
          variables: Object.keys(variables),
        },
        output: {
          success: false,
          executionTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        metadata: {
          type: 'prompt-execution-error',
        },
      });

      throw error;
    }
  }

  /**
   * Get the latest version of a prompt
   */
  private async getPromptVersion(promptName: string): Promise<PromptVersion | null> {
    // Check cache first
    if (this.promptCache.has(promptName)) {
      return this.promptCache.get(promptName)!;
    }

    // For now, we'll use the existing prompt system
    // In a production system, you might want to store these in a database
    // or use LangFuse's prompt management features
    try {
      // Dynamic import to avoid circular dependencies
      const prompts = await import('@/prompts/prompt.helper');

      // This is a simplified approach - you'd want to load prompts from a proper source
      const promptContent = this.getPromptFromExistingSystem(promptName);

      if (!promptContent) {
        return null;
      }

      const promptVersion: PromptVersion = {
        id: `${promptName}-v1`,
        name: promptName,
        version: 1,
        content: promptContent,
        variables: this.extractVariables(promptContent),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.promptCache.set(promptName, promptVersion);
      return promptVersion;
    } catch (error) {
      logger.error(`Error loading prompt '${promptName}':`, error);
      return null;
    }
  }

  /**
   * Inject variables into prompt content
   */
  private injectVariables(prompt: string, variables: Record<string, string>): string {
    const promptVariables = prompt.match(/{{(.*?)}}/g);

    if (promptVariables) {
      promptVariables.forEach((variable) => {
        const variableName = variable.slice(2, -2); // Remove {{ and }}
        if (!(variableName in variables)) {
          throw new Error(`Input variable ${variable} not found in prompt variables`);
        }
      });
    }

    return prompt.replace(/{{(.*?)}}/g, (match, p1) => {
      return variables[p1] || match;
    });
  }

  /**
   * Extract variable names from prompt content
   */
  private extractVariables(prompt: string): string[] {
    const variables = prompt.match(/{{(.*?)}}/g);
    return variables ? variables.map(v => v.slice(2, -2)) : [];
  }

  /**
   * Get prompt content from existing system (temporary bridge)
   */
  private getPromptFromExistingSystem(promptName: string): string | null {
    // This is a bridge to the existing prompt system
    // In a real implementation, you'd load from a database or LangFuse
    try {
      switch (promptName) {
        case 'summarize_site':
          return require('@/prompts/summarize_site.prompt.ts').default;
        case 'vendor_fit':
          return require('@/prompts/vendor_fit.prompt.ts').default;
        case 'smart_filter_site':
          return require('@/prompts/smart_filter_site.prompt.ts').default;
        case 'contact_strategy':
          return require('@/prompts/contact_strategy.prompt.ts').default;
        case 'extractContacts':
          return require('@/prompts/extractContacts.prompt.ts').default;
        case 'find_contacts':
          return require('@/prompts/find_contacts.prompt.ts').default;
        default:
          return null;
      }
    } catch (error) {
      logger.error(`Error loading prompt ${promptName}:`, error);
      return null;
    }
  }

  /**
   * Create a new version of a prompt
   */
  async createPromptVersion(
    promptName: string,
    content: string,
    description?: string
  ): Promise<PromptVersion> {
    const promptVersion: PromptVersion = {
      id: `${promptName}-v${Date.now()}`,
      name: promptName,
      version: Date.now(), // Simple versioning based on timestamp
      content,
      description,
      variables: this.extractVariables(content),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store in LangFuse
    this.langfuseClient?.event({
      name: 'prompt-version-created',
      input: {
        promptName,
        version: promptVersion.version,
        variables: promptVersion.variables,
      },
      output: {
        promptId: promptVersion.id,
        description,
        contentLength: content.length,
      },
      metadata: {
        type: 'prompt-version-created',
      },
    });

    this.promptCache.set(promptName, promptVersion);
    return promptVersion;
  }

  /**
   * Get all versions of a prompt
   */
  async getPromptVersions(promptName: string): Promise<PromptVersion[]> {
    // For now, just return the cached version
    const version = await this.getPromptVersion(promptName);
    return version ? [version] : [];
  }

  /**
   * Clear the prompt cache
   */
  clearCache(): void {
    this.promptCache.clear();
  }
}

// Export singleton instance
export const promptManager = PromptManager.getInstance();