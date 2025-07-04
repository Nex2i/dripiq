import { OpenAIClient } from '../implementations/OpenAIClient';
import { ToolRegistry } from '../implementations/ToolRegistry';
import { ITool } from '../interfaces/ITool';

// Import concrete tool implementations
import { GeneralSiteReportService, GeneralSiteReportConfig } from './generalSiteReport.service';

export class GeneralSiteReportServiceFactory {
  static createDefault(config?: GeneralSiteReportConfig): GeneralSiteReportService {
    // Create AI client
    const aiClient = new OpenAIClient();

    // Create tool registry
    const toolRegistry = new ToolRegistry();

    // Register default tools
    const defaultTools: ITool[] = [
      // new GetInformationAboutDomainTool(),
      // new ListDomainPagesTool(),
      // new RetrieveFullPageTool(),
    ];

    defaultTools.forEach((tool) => toolRegistry.registerTool(tool));

    // Create and return service
    return new GeneralSiteReportService(aiClient, toolRegistry, config);
  }

  static createWithCustomTools(
    tools: any[],
    config?: GeneralSiteReportConfig
  ): GeneralSiteReportService {
    // Create AI client
    const aiClient = new OpenAIClient();

    // Create tool registry
    const toolRegistry = new ToolRegistry();

    // Register custom tools
    tools.forEach((tool) => toolRegistry.registerTool(tool));

    // Create and return service
    return new GeneralSiteReportService(aiClient, toolRegistry, config);
  }

  static createEmpty(config?: GeneralSiteReportConfig): GeneralSiteReportService {
    // Create AI client
    const aiClient = new OpenAIClient();

    // Create empty tool registry
    const toolRegistry = new ToolRegistry();

    // Create and return service with no tools registered
    return new GeneralSiteReportService(aiClient, toolRegistry, config);
  }
}

// Export a default configured instance for backward compatibility
export const generalSiteReportService = GeneralSiteReportServiceFactory.createDefault({
  maxIterations: 5,
  model: 'gpt-4.1',
  enableWebSearch: true,
});
