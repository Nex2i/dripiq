import { logger } from '@/libs/logger';
import { langfuseService } from './langfuse.service';
import { promptService } from './prompt.service';

/**
 * Service for handling LangFuse setup and data migration
 */
class MigrationService {
  /**
   * Initialize LangFuse observability on server startup
   */
  public async initializeObservability(): Promise<void> {
    if (!langfuseService.isReady()) {
      logger.info('LangFuse observability is not configured or disabled');
      return;
    }

    logger.info('Initializing LangFuse observability...');

    try {
      // Test connection
      const client = langfuseService.getClient();
      if (!client) {
        logger.warn('LangFuse client not available');
        return;
      }

      // Log initialization event
      langfuseService.logEvent('server_startup', {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown',
      });

      logger.info('LangFuse observability initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize LangFuse observability:', error);
    }
  }

  /**
   * Migrate local prompts to LangFuse (run manually or on deployment)
   */
  public async migratePrompts(): Promise<void> {
    if (!langfuseService.isReady()) {
      logger.warn('LangFuse not ready, skipping prompt migration');
      return;
    }

    logger.info('Starting prompt migration to LangFuse...');

    try {
      await promptService.migrateLocalPromptsToLangFuse();
      logger.info('Prompt migration completed successfully');
    } catch (error) {
      logger.error('Prompt migration failed:', error);
    }
  }

  /**
   * Create evaluation datasets for agent performance monitoring
   */
  public async createEvaluationDatasets(): Promise<void> {
    if (!langfuseService.isReady()) {
      logger.warn('LangFuse not ready, skipping dataset creation');
      return;
    }

    logger.info('Creating evaluation datasets...');

    try {
      // Site Analysis Dataset
      const siteAnalysisDataset = langfuseService.createDataset(
        'site-analysis-eval',
        'Dataset for evaluating site analysis agent performance'
      );

      // Vendor Fit Dataset
      const vendorFitDataset = langfuseService.createDataset(
        'vendor-fit-eval',
        'Dataset for evaluating vendor fit analysis performance'
      );

      // Contact Extraction Dataset
      const contactExtractionDataset = langfuseService.createDataset(
        'contact-extraction-eval',
        'Dataset for evaluating contact extraction performance'
      );

      // Contact Strategy Dataset
      const contactStrategyDataset = langfuseService.createDataset(
        'contact-strategy-eval',
        'Dataset for evaluating contact strategy generation performance'
      );

      logger.info('Evaluation datasets created successfully');
    } catch (error) {
      logger.error('Failed to create evaluation datasets:', error);
    }
  }

  /**
   * Add sample evaluation data to datasets
   */
  public async seedEvaluationData(): Promise<void> {
    if (!langfuseService.isReady()) {
      logger.warn('LangFuse not ready, skipping evaluation data seeding');
      return;
    }

    logger.info('Seeding evaluation datasets with sample data...');

    try {
      // Site Analysis Sample
      langfuseService.createDatasetItem(
        'site-analysis-eval',
        { domain: 'example.com' },
        {
          summary: 'Example company providing software solutions',
          products: ['Software Platform'],
          services: ['Consulting', 'Support'],
          differentiators: ['AI-powered', 'User-friendly'],
          targetMarket: 'SMB',
          tone: 'Professional',
        },
        { category: 'sample', source: 'manual' }
      );

      // Vendor Fit Sample
      langfuseService.createDatasetItem(
        'vendor-fit-eval',
        {
          partnerInfo: { domain: 'partner.com', products: ['CRM'], services: ['Implementation'] },
          opportunityContext: 'Looking for CRM solution for 100+ employees',
        },
        {
          headline: 'Strong Fit for CRM Implementation',
          summary: 'Partner specializes in CRM solutions for mid-market companies',
          marketAlignment: 'High',
          brandToneMatch: 'Professional',
        },
        { category: 'sample', source: 'manual' }
      );

      logger.info('Evaluation datasets seeded with sample data');
    } catch (error) {
      logger.error('Failed to seed evaluation data:', error);
    }
  }

  /**
   * Full setup including initialization, migration, and dataset creation
   */
  public async setupLangFuse(): Promise<void> {
    await this.initializeObservability();
    await this.migratePrompts();
    await this.createEvaluationDatasets();
    await this.seedEvaluationData();

    // Flush all events
    await langfuseService.flush();
  }

  /**
   * Health check for LangFuse integration
   */
  public async healthCheck(): Promise<{
    isReady: boolean;
    clientAvailable: boolean;
    error?: string;
  }> {
    try {
      const isReady = langfuseService.isReady();
      const clientAvailable = langfuseService.getClient() !== null;

      return {
        isReady,
        clientAvailable,
      };
    } catch (error) {
      return {
        isReady: false,
        clientAvailable: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton instance
export const migrationService = new MigrationService();
