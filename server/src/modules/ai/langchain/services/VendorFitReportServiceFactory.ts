import { VendorFitReportService } from './VendorFitReportService';
import { ReportConfig } from '../config/langchain.config';

export class VendorFitReportServiceFactory {
  static createDefault(config?: ReportConfig): VendorFitReportService {
    return new VendorFitReportService(config);
  }

  static createWithCustomConfig(config: ReportConfig): VendorFitReportService {
    return new VendorFitReportService(config);
  }
}

// Export default instance for backward compatibility
export const vendorFitReportService = VendorFitReportServiceFactory.createDefault({
  maxIterations: 10,
  temperature: 0.1,
});