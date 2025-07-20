import { ITool } from '../interfaces/ITool';
import { ReportConfig } from '../interfaces/IReport';
import { VendorFitReportService } from './vendorFitReport.service';
import { createAIClientAndToolRegistry, getDefaultTools, AI_MODELS } from './shared';

export class VendorFitReportServiceFactory {
  /**
   * Creates a VendorFitReportService with the default set of tools
   * @param config Optional configuration overrides
   * @returns Configured VendorFitReportService instance
   */
  static createWithDefaultTools(config?: ReportConfig): VendorFitReportService {
    const defaultTools = getDefaultTools();
    const { aiClient, toolRegistry } = createAIClientAndToolRegistry(defaultTools);

    return new VendorFitReportService(aiClient, toolRegistry, config);
  }

  /**
   * Creates a VendorFitReportService with custom tools
   * @param tools Array of ITool instances to register
   * @param config Optional configuration overrides
   * @returns Configured VendorFitReportService instance
   */
  static createWithCustomTools(tools: ITool[], config?: ReportConfig): VendorFitReportService {
    if (!tools?.length) {
      throw new Error('Custom tools array cannot be empty or null');
    }

    const { aiClient, toolRegistry } = createAIClientAndToolRegistry(tools);

    return new VendorFitReportService(aiClient, toolRegistry, config);
  }

  /**
   * Creates a VendorFitReportService with no tools registered
   * Tools can be added later using registerTool() or registerTools()
   * @param config Optional configuration overrides
   * @returns Configured VendorFitReportService instance with empty tool registry
   */
  static createEmpty(config?: ReportConfig): VendorFitReportService {
    const { aiClient, toolRegistry } = createAIClientAndToolRegistry([]);

    return new VendorFitReportService(aiClient, toolRegistry, config);
  }

  /**
   * @deprecated Use createWithDefaultTools instead
   * @param config Optional configuration overrides
   * @returns Configured VendorFitReportService instance
   */
  static createDefault(config?: ReportConfig): VendorFitReportService {
    return this.createWithDefaultTools(config);
  }
}

/**
 * Pre-configured default instance of VendorFitReportService
 * Uses default tools and moderate configuration settings
 */
export const vendorFitReportService = VendorFitReportServiceFactory.createWithDefaultTools({
  maxIterations: 5,
  model: AI_MODELS.GPT_4_1,
  enableWebSearch: false,
});
