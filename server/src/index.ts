import dotenv from 'dotenv';
import { getNetworkAddress } from '@/utils/network';
import App from './app';
import { logger } from './libs/logger';
import { SEQ_SERVER_URL, IS_PRODUCTION } from './config';

dotenv.config();
const PORT: number = Number(process.env.PORT || 3001);

(async () => {
  try {
    const app = await App();

    console.log('PORT from env:', process.env.PORT);
    console.log('PORT:', PORT);

    app.listen({ port: Number(PORT), host: '0.0.0.0' }, () => {
      const networkAddress = getNetworkAddress();
      logger.info(
        `Server running on port ${PORT} \nLocal: https://localhost:${PORT} \nNetwork: https://${networkAddress}:${PORT}`
      );

      // Log SEQ configuration status
      if (!IS_PRODUCTION && SEQ_SERVER_URL) {
        logger.info('SEQ logging enabled', { 
          seqServerUrl: SEQ_SERVER_URL,
          environment: process.env.NODE_ENV 
        });
      } else if (!IS_PRODUCTION && !SEQ_SERVER_URL) {
        logger.info('SEQ logging disabled - no SEQ_SERVER_URL configured', {
          environment: process.env.NODE_ENV
        });
      } else {
        logger.info('SEQ logging disabled - production environment', {
          environment: process.env.NODE_ENV
        });
      }
    });
  } catch (error) {
    logger.error('Error running server:', error);
  }
})();
