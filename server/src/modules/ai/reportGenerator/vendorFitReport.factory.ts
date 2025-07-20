import { OpenAIClient } from '../implementations/OpenAIClient';
import { ToolRegistry } from '../implementations/ToolRegistry';
import { ITool } from '../interfaces/ITool';

// Import concrete tool implementations
import { GetInformationAboutDomainTool } from '../tools/GetInformationAboutDomainTool';
import { ListDomainPagesTool } from '../tools/ListDomainPagesTool';
import { RetrieveFullPageTool } from '../tools/RetrieveFullPageTool';
import { ReportConfig } from '../interfaces/IReport';
import { VendorFitReportService } from './vendorFitReport.service';

export class VendorFitReportServiceFactory {
  static createDefault(config?: ReportConfig): VendorFitReportService {
    // Create AI client
    const aiClient = new OpenAIClient();

    // Create tool registry
    const toolRegistry = new ToolRegistry();

    // Register default tools
    const defaultTools: ITool[] = [
      new GetInformationAboutDomainTool(),
      new ListDomainPagesTool(),
      new RetrieveFullPageTool(),
    ];

    defaultTools.forEach((tool) => toolRegistry.registerTool(tool));

    // Create and return service
    return new VendorFitReportService(aiClient, toolRegistry, config);
  }

  static createWithCustomTools(tools: any[], config?: ReportConfig): VendorFitReportService {
    // Create AI client
    const aiClient = new OpenAIClient();

    // Create tool registry
    const toolRegistry = new ToolRegistry();

    // Register custom tools
    tools.forEach((tool) => toolRegistry.registerTool(tool));

    // Create and return service
    return new VendorFitReportService(aiClient, toolRegistry, config);
  }

  static createEmpty(config?: ReportConfig): VendorFitReportService {
    // Create AI client
    const aiClient = new OpenAIClient();

    // Create empty tool registry
    const toolRegistry = new ToolRegistry();

    // Create and return service with no tools registered
    return new VendorFitReportService(aiClient, toolRegistry, config);
  }
}

// Export a default configured instance for backward compatibility
export const vendorFitReportService = VendorFitReportServiceFactory.createDefault({
  maxIterations: 5,
  model: 'gpt-4.1-mini',
  enableWebSearch: false,
});
