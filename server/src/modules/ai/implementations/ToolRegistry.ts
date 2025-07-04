import { logger } from '@/libs/logger';
import { ITool, IToolResult, IToolDefinition } from '../interfaces/ITool';
import { IToolRegistry } from '../interfaces/IToolRegistry';

export class ToolRegistry implements IToolRegistry {
  private tools: Map<string, ITool> = new Map();

  registerTool(tool: ITool): void {
    const definition = tool.getDefinition();
    this.tools.set(definition.name, tool);
    logger.info(`Registered tool: ${definition.name}`);
  }

  unregisterTool(name: string): void {
    if (this.tools.delete(name)) {
      logger.info(`Unregistered tool: ${name}`);
    } else {
      logger.warn(`Attempted to unregister non-existent tool: ${name}`);
    }
  }

  getTool(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): ITool[] {
    return Array.from(this.tools.values());
  }

  getToolDefinitions(): IToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => tool.getDefinition());
  }

  async executeTool(name: string, args: any): Promise<IToolResult> {
    const tool = this.tools.get(name);

    if (!tool) {
      logger.error(`Tool not found: ${name}`);
      return {
        success: false,
        error: `Tool '${name}' not found in registry`,
      };
    }

    try {
      logger.info(`Executing tool: ${name}`, { args });
      const result = await tool.execute(args);

      if (result.success) {
        logger.info(`Tool execution successful: ${name}`);
      } else {
        logger.warn(`Tool execution failed: ${name}`, { error: result.error });
      }

      return result;
    } catch (error) {
      logger.error(`Error executing tool ${name}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
