// Export all workers for easy importing
export { default as leadAnalysisWorker } from './lead-analysis/lead-analysis.worker';
export { default as campaignCreationWorker } from './campaign-creation/campaign-creation.worker';

// Export worker runner functions
export { startWorkers, gracefulShutdown } from './worker.run';

// Export worker result types
export type { LeadAnalysisJobResult } from './lead-analysis/lead-analysis.worker';
export type { CampaignCreationJobResult } from './campaign-creation/campaign-creation.worker';
