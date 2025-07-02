import pino, { Logger, LoggerOptions } from 'pino';
import { IS_PRODUCTION, SEQ_SERVER_URL, SEQ_API_KEY, NODE_ENV } from '@/config';

// Create transport array based on environment
const createTransports = () => {
  const transports: any[] = [
    // Always include pretty printing for console
    {
      target: 'pino-pretty',
      options: {
        translateTime: true,
        ignore: 'pid,hostname',
        levelFirst: true,
        prettifier: true,
        useLevelLabels: true,
        levelKey: 'level',
      },
    },
  ];

  // Add SEQ transport for non-production environments if configured
  if (!IS_PRODUCTION && SEQ_SERVER_URL) {
    transports.push({
      target: 'pino-seq',
      options: {
        serverUrl: SEQ_SERVER_URL,
        apiKey: SEQ_API_KEY, // Optional: only if authentication is required
        onError: (error: Error) => {
          console.warn('SEQ logging error:', error.message);
        },
      },
    });
  }

  return transports;
};

const loggerOptions: LoggerOptions = {
  transport: {
    targets: createTransports(),
  },
  level: 'warn',
  // Add base metadata that will be included with every log entry
  base: {
    environment: NODE_ENV,
    application: 'promptdepot-server',
    version: process.env.npm_package_version || '1.0.0',
  },
};

export const baseLogger = pino(loggerOptions);

const formatArg = (arg: any): any => {
  if (arg && typeof arg === 'object' && !Array.isArray(arg)) {
    const formattedObject: any = {};
    for (const [key, value] of Object.entries(arg)) {
      formattedObject[key] = formatArg(value);
    }
    return formattedObject;
  }
  return arg;
};

const createLoggerWithOverride = (logger: Logger) => {
  return {
    warn: (message: string, arg?: any, ...args: any[]) => {
      logger.warn({ payload: formatArg(arg), ...args }, message);
    },
    info: (message: string, arg?: any) => {
      console.log(message, arg ? formatArg(arg) : '');
      logger.info({ payload: formatArg(arg) }, message);
    },
    error: (message: string, arg?: any, ...args: any[]) => {
      logger.error({ payload: formatArg(arg), ...args }, message);
    },
    debug: (message: string, arg?: any) => {
      logger.debug({ payload: formatArg(arg) }, message);
    },
  };
};

export const logger = createLoggerWithOverride(baseLogger);
