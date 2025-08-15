import pino, { Logger, LoggerOptions } from 'pino';

// highlight.io configuration
const highlightConfig = {
  projectID: process.env.HIGHLIGHT_PROJECT_ID || '', // You'll need to set this in your environment
  serviceName: process.env.SERVICE_NAME || 'dripiq-backend',
  serviceVersion: process.env.SERVICE_VERSION || 'latest',
  environment: process.env.NODE_ENV || 'development',
};

export const loggerOptions: LoggerOptions = {
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  formatters: {
    level: (label) => {
      return { level: pino.levels.values[label] };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Use highlight.io transport in production, pretty printing in development
  transport:
    process.env.NODE_ENV === 'production'
      ? {
          target: '@highlight-run/pino',
          options: highlightConfig,
        }
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
  // Configure request/response serializers for structured logging
  serializers: {
    req: (request: any) => ({
      method: request.method,
      url: request.url,
      host: request.headers?.host,
      userAgent: request.headers?.['user-agent'],
      remoteAddress: request.ip || request.socket?.remoteAddress,
      remotePort: request.socket?.remotePort,
      reqId: request.id,
    }),
    res: (response: any) => ({
      statusCode: response.statusCode,
      contentLength: response.headers?.['content-length'],
    }),
    err: pino.stdSerializers.err,
  },
};

export const baseLogger = pino(loggerOptions);

// Initialize highlight.io SDK if in Node.js environment
if (typeof process.env.NEXT_RUNTIME === 'undefined' || process.env.NEXT_RUNTIME === 'nodejs') {
  if (process.env.NODE_ENV === 'production' && highlightConfig.projectID) {
    try {
      const { H } = require('@highlight-run/node');
      H.init(highlightConfig);
    } catch (error) {
      console.warn('Failed to initialize highlight.io:', error);
    }
  }
}

// Create a logger interface that maintains compatibility with your existing code
const createLoggerWithOverride = (logger: Logger) => {
  return {
    warn: (message: string, arg?: any, ...args: any[]) => {
      const logObj = arg ? { payload: arg, ...args } : { ...args };
      logger.warn(logObj, message);
    },
    info: (message: string, arg?: any) => {
      const logObj = arg ? { payload: arg } : {};
      logger.info(logObj, message);
    },
    error: (message: string, arg?: any, ...args: any[]) => {
      const logObj = arg ? { payload: arg, ...args } : { ...args };
      logger.error(logObj, message);
    },
    debug: (message: string, arg?: any) => {
      const logObj = arg ? { payload: arg } : {};
      logger.debug(logObj, message);
    },
  };
};

export const logger = createLoggerWithOverride(baseLogger);
