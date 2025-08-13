import dotenv from 'dotenv';
import { getNetworkAddress } from '@/utils/network';
import App from './app';
import { logger } from './libs/logger';
import { startSenderIdentityPoller } from '@/modules/email/senderIdentityPoller';

dotenv.config();
const PORT: number = Number(process.env.PORT || 3001);

(async () => {
  try {
    const app = await App();

    // Start background poller(s)
    startSenderIdentityPoller();

    console.log('PORT from env:', process.env.PORT);
    console.log('PORT:', PORT);

    app.listen({ port: Number(PORT), host: '0.0.0.0' }, () => {
      const networkAddress = getNetworkAddress();
      logger.info(
        `Server running on port ${PORT} \nLocal: https://localhost:${PORT} \nNetwork: https://${networkAddress}:${PORT}`
      );
    });
  } catch (error) {
    logger.error('Error running server:', error);
  }
})();
