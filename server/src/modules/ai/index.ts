// Export interfaces
export type {
  ITool,
  IToolResult,
  IToolDefinition,
  IToolCall,
  IToolCallResult,
} from './interfaces/ITool';
export type { IAIClient, IAIMessage, IAIResponse, IAIRequestOptions } from './interfaces/IAIClient';
export type { IToolRegistry } from './interfaces/IToolRegistry';

// Export implementations
export { OpenAIClient } from './implementations/OpenAIClient';
export { ToolRegistry } from './implementations/ToolRegistry';

// Export new general site report service
export {
  GeneralSiteReportService,
  type GeneralSiteReportConfig,
} from './reportGenerator/generalSiteReport.service';

// Export new factory
export {
  GeneralSiteReportServiceFactory,
  generalSiteReportService,
} from './reportGenerator/generalSiteReport.factory';

// Export tool implementations
export { GetInformationAboutDomainTool } from './tools/GetInformationAboutDomainTool';
export { ListDomainPagesTool } from './tools/ListDomainPagesTool';
export { RetrieveFullPageTool } from './tools/RetrieveFullPageTool';

// Export backward compatibility services (deprecated)
export {
  ReportGeneratorService,
  type ReportGeneratorConfig,
} from './reportGenerator/reportGenerator.service';

// For backward compatibility, users can import the original service class
// and create their own instance
