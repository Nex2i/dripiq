import dotenv from 'dotenv';
import { getNetworkAddress } from '@/utils/network';
import App from './app';
import { logger } from './libs/logger';
import { setupGracefulShutdown } from '@/libs/shutdown';

dotenv.config();
const PORT: number = Number(process.env.PORT || 3001);

(async () => {
  try {
    const app = await App();

    logger.info('PORT', { port: PORT });

    const server = app.listen({ port: Number(PORT), host: '0.0.0.0' }, () => {
      const networkAddress = getNetworkAddress();
      logger.info(
        `Server running on port ${PORT} \nLocal: https://localhost:${PORT} \nNetwork: https://${networkAddress}:${PORT}`
      );
    });

    // Setup graceful shutdown handlers
    setupGracefulShutdown(server, {
      timeout: 10000, // 10 seconds timeout for shutdown
      forceExit: true,
    });

  } catch (error) {
    logger.error('Error running server:', error);
    process.exit(1);
  }
})();
