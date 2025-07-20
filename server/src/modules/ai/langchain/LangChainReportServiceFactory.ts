import { DynamicStructuredTool } from '@langchain/core/tools';
import { ReportConfig } from '../interfaces/IReport';
import { LangChainReportService } from './LangChainReportService';
import { GetInformationAboutDomainTool } from './tools/GetInformationAboutDomainTool';
import { ListDomainPagesTool } from './tools/ListDomainPagesTool';
import { RetrieveFullPageTool } from './tools/RetrieveFullPageTool';
import { AI_MODELS } from '../reportGenerator/shared';

export class LangChainReportServiceFactory {
  /**
   * Creates a LangChainReportService with the default set of tools
   * @param config Optional configuration overrides
   * @returns Configured LangChainReportService instance
   */
  static createWithDefaultTools(config?: ReportConfig): LangChainReportService {
    const defaultTools = this.getDefaultTools();
    return new LangChainReportService(defaultTools, config);
  }

  /**
   * Creates a LangChainReportService with custom tools
   * @param tools Array of LangChain Tool instances to register
   * @param config Optional configuration overrides
   * @returns Configured LangChainReportService instance
   */
  static createWithCustomTools(tools: DynamicStructuredTool[], config?: ReportConfig): LangChainReportService {
    if (!tools?.length) {
      throw new Error('Custom tools array cannot be empty or null');
    }

    return new LangChainReportService(tools, config);
  }

  /**
   * Creates a LangChainReportService with no tools registered
   * Tools can be added later using addTool() or addTools()
   * @param config Optional configuration overrides
   * @returns Configured LangChainReportService instance with empty tool registry
   */
  static createEmpty(config?: ReportConfig): LangChainReportService {
    return new LangChainReportService([], config);
  }

  /**
   * Gets the default tools used by report services
   */
  private static getDefaultTools(): DynamicStructuredTool[] {
    return [
      new GetInformationAboutDomainTool(),
      new ListDomainPagesTool(),
      new RetrieveFullPageTool(),
    ];
  }

  /**
   * @deprecated Use createWithDefaultTools instead
   * @param config Optional configuration overrides
   * @returns Configured LangChainReportService instance
   */
  static createDefault(config?: ReportConfig): LangChainReportService {
    return this.createWithDefaultTools(config);
  }
}

/**
 * Pre-configured default instance of LangChainReportService
 * Uses default tools and moderate configuration settings
 */
export const langChainReportService = LangChainReportServiceFactory.createWithDefaultTools({
  maxIterations: 5,
  model: AI_MODELS.GPT_4_1,
  enableWebSearch: false,
});