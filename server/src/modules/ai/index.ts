// Export services
export { ContactExtractionService } from './contactExtraction.service';
export {
  generateContactStrategy,
  updateContactStrategy,
  retrieveContactStrategyFromDatabase,
} from './contactStrategy.service';

// Export LangChain-based AI system
export {
  SiteAnalysisAgent,
  VendorFitAgent,
  ContactExtractionAgent,
  ContactStrategyAgent,
  siteAnalysisAgent,
  vendorFitAgent,
  contactExtractionAgent,
  createSiteAnalysisAgent,
  createVendorFitAgent,
  createContactExtractionAgent,
  createContactStrategyAgent,
  RetrieveFullPageTool,
  GetInformationAboutDomainTool,
  ListDomainPagesTool,
  createChatModel,
  defaultLangChainConfig,
  type LangChainConfig,
  type ReportConfig,
  type SiteAnalysisResult,
  type VendorFitResult,
  type ContactExtractionResult,
  type ContactStrategyResult,
} from './langchain';
