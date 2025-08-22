/**
 * Configuration for startup recovery of scheduled actions
 */
export const RECOVERY_CONFIG = {
  // How long past due before considering an action expired (1 hour default)
  EXPIRY_THRESHOLD_MS: parseInt(process.env.RECOVERY_EXPIRY_THRESHOLD_MS || '3600000'), // 1 hour

  // How long past scheduled time before considering action orphaned (5 minutes default)
  ORPHAN_THRESHOLD_MS: parseInt(process.env.RECOVERY_ORPHAN_THRESHOLD_MS || '300000'), // 5 minutes

  // Whether to enable recovery on startup
  ENABLED: process.env.RECOVERY_ENABLED !== 'false', // Default enabled

  // Maximum number of actions to recover in single batch
  BATCH_SIZE: parseInt(process.env.RECOVERY_BATCH_SIZE || '1000'),
};
