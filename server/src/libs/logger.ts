import pino, { Logger, LoggerOptions } from 'pino';

const loggerOptions: LoggerOptions = {
  transport: {
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
  level: 'warn',
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
