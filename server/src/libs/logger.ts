import pino, { Logger, LoggerOptions } from 'pino';

const loggerOptions: LoggerOptions = {
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  formatters: {
    level: (label) => {
      return { level: pino.levels.values[label] };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
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
      const logObj = arg ? { payload: formatArg(arg), ...args } : { ...args };
      logger.warn(logObj, message);
    },
    info: (message: string, arg?: any) => {
      const logObj = arg ? { payload: formatArg(arg) } : {};
      logger.info(logObj, message);
    },
    error: (message: string, arg?: any, ...args: any[]) => {
      const logObj = arg ? { payload: formatArg(arg), ...args } : { ...args };
      logger.error(logObj, message);
    },
    debug: (message: string, arg?: any) => {
      const logObj = arg ? { payload: formatArg(arg) } : {};
      logger.debug(logObj, message);
    },
  };
};

export const logger = createLoggerWithOverride(baseLogger);
