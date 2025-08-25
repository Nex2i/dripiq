import pino, { Logger, LoggerOptions } from 'pino';
import { H } from '@highlight-run/node';

// highlight.io configuration
const highlightConfig = {
  projectID: process.env.HIGHLIGHT_PROJECT_ID || '130249',
  serviceName: process.env.SERVICE_NAME || 'dripiq-backend',
  serviceVersion: process.env.SERVICE_VERSION || 'latest',
  environment: process.env.NODE_ENV || 'development',
};

export const loggerOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
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
          options: {
            ...highlightConfig,
            // Ensure all log properties are included
            includeStackTrace: true,
          },
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
    error: pino.stdSerializers.err, // Also handle 'error' key
  },
};

export const baseLogger = pino(loggerOptions);

// Initialize highlight.io SDK if in Node.js environment
if (typeof process.env.NEXT_RUNTIME === 'undefined' || process.env.NEXT_RUNTIME === 'nodejs') {
  if (process.env.NODE_ENV === 'production' && highlightConfig.projectID) {
    try {
      H.init(highlightConfig);
    } catch (error) {
      console.warn('Failed to initialize highlight.io:', error);
    }
  }
}

// Create a logger interface that maintains compatibility with your existing code
const createLoggerWithOverride = (logger: Logger) => {
  return {
    warn: (message: string, payload?: any) => {
      if (payload && typeof payload === 'object') {
        // Ensure error objects are properly serialized
        const serializedPayload = { ...payload };
        if (serializedPayload.error && serializedPayload.error instanceof Error) {
          serializedPayload.error = {
            name: serializedPayload.error.name,
            message: serializedPayload.error.message,
            stack: serializedPayload.error.stack,
            ...serializedPayload.error,
          };
        }
        logger.warn(serializedPayload, message);
      } else {
        logger.warn(message);
      }
    },
    info: (message: string, payload?: any) => {
      if (payload && typeof payload === 'object') {
        const serializedPayload = { ...payload };
        if (serializedPayload.error && serializedPayload.error instanceof Error) {
          serializedPayload.error = {
            name: serializedPayload.error.name,
            message: serializedPayload.error.message,
            stack: serializedPayload.error.stack,
            ...serializedPayload.error,
          };
        }
        logger.info(serializedPayload, message);
      } else {
        logger.info(message);
      }
    },
    error: (message: string, payload?: any) => {
      if (payload && typeof payload === 'object') {
        const serializedPayload = { ...payload };
        if (serializedPayload.error && serializedPayload.error instanceof Error) {
          serializedPayload.error = {
            name: serializedPayload.error.name,
            message: serializedPayload.error.message,
            stack: serializedPayload.error.stack,
            ...serializedPayload.error,
          };
        }
        logger.error(serializedPayload, message);
      } else {
        logger.error(message);
      }
    },
    debug: (message: string, payload?: any) => {
      if (payload && typeof payload === 'object') {
        const serializedPayload = { ...payload };
        if (serializedPayload.error && serializedPayload.error instanceof Error) {
          serializedPayload.error = {
            name: serializedPayload.error.name,
            message: serializedPayload.error.message,
            stack: serializedPayload.error.stack,
            ...serializedPayload.error,
          };
        }
        logger.debug(serializedPayload, message);
      } else {
        logger.debug(message);
      }
    },
  };
};

export const logger = createLoggerWithOverride(baseLogger);

// Utility function to manually report errors to Highlight.io with full context
export const reportErrorToHighlight = (
  error: Error,
  message: string,
  context?: Record<string, any>
) => {
  if (process.env.NODE_ENV === 'production') {
    try {
      H.consumeError(error, message, 'UNKNOWN_REQUEST_ID', context);
    } catch (highlightError) {
      console.warn('Failed to report error to Highlight.io:', highlightError);
    }
  }

  // Also log normally
  logger.error(message, { error, ...context });
};
