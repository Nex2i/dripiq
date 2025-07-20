import { GeneralSiteReportService } from './GeneralSiteReportService';
import { ReportConfig } from '../config/langchain.config';

export class GeneralSiteReportServiceFactory {
  static createDefault(config?: ReportConfig): GeneralSiteReportService {
    return new GeneralSiteReportService(config);
  }

  static createWithCustomConfig(config: ReportConfig): GeneralSiteReportService {
    return new GeneralSiteReportService(config);
  }
}

// Export default instance for backward compatibility
export const generalSiteReportService = GeneralSiteReportServiceFactory.createDefault({
  maxIterations: 10,
  temperature: 0.1,
});