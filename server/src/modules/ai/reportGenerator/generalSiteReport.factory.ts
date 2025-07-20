import { ITool } from '../interfaces/ITool';
import { ReportConfig } from '../interfaces/IReport';
import { GeneralSiteReportService } from './generalSiteReport.service';
import { createAIClientAndToolRegistry, getDefaultTools, AI_MODELS } from './shared';

export class GeneralSiteReportServiceFactory {
  /**
   * Creates a GeneralSiteReportService with the default set of tools
   * @param config Optional configuration overrides
   * @returns Configured GeneralSiteReportService instance
   */
  static createWithDefaultTools(config?: ReportConfig): GeneralSiteReportService {
    const defaultTools = getDefaultTools();
    const { aiClient, toolRegistry } = createAIClientAndToolRegistry(defaultTools);

    return new GeneralSiteReportService(aiClient, toolRegistry, config);
  }

  /**
   * Creates a GeneralSiteReportService with custom tools
   * @param tools Array of ITool instances to register
   * @param config Optional configuration overrides
   * @returns Configured GeneralSiteReportService instance
   */
  static createWithCustomTools(tools: ITool[], config?: ReportConfig): GeneralSiteReportService {
    if (!tools?.length) {
      throw new Error('Custom tools array cannot be empty or null');
    }

    const { aiClient, toolRegistry } = createAIClientAndToolRegistry(tools);

    return new GeneralSiteReportService(aiClient, toolRegistry, config);
  }

  /**
   * Creates a GeneralSiteReportService with no tools registered
   * Tools can be added later using registerTool() or registerTools()
   * @param config Optional configuration overrides
   * @returns Configured GeneralSiteReportService instance with empty tool registry
   */
  static createEmpty(config?: ReportConfig): GeneralSiteReportService {
    const { aiClient, toolRegistry } = createAIClientAndToolRegistry([]);

    return new GeneralSiteReportService(aiClient, toolRegistry, config);
  }

  /**
   * @deprecated Use createWithDefaultTools instead
   * @param config Optional configuration overrides
   * @returns Configured GeneralSiteReportService instance
   */
  static createDefault(config?: ReportConfig): GeneralSiteReportService {
    return this.createWithDefaultTools(config);
  }
}

/**
 * Pre-configured default instance of GeneralSiteReportService
 * Uses default tools and moderate configuration settings
 */
export const generalSiteReportService = GeneralSiteReportServiceFactory.createWithDefaultTools({
  maxIterations: 5,
  model: AI_MODELS.GPT_4_1,
  enableWebSearch: false,
});
