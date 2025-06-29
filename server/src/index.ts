import dotenv from 'dotenv';
import { getNetworkAddress } from '@/utils/network';
import App from './app';
import { logger } from './libs/logger';

dotenv.config();
const PORT: number = Number(process.env.PORT || 3001);

(async () => {
  const app = await App();

  console.log('PORT from env:', process.env.PORT);
  console.log('PORT:', PORT);

  app.listen({ port: Number(PORT), host: '0.0.0.0' }, () => {
    const networkAddress = getNetworkAddress();
    logger.info(
      `Server running on port ${PORT} \nLocal: https://localhost:${PORT} \nNetwork: https://${networkAddress}:${PORT}`
    );
  });
})();
