import pino, { Logger, LoggerOptions } from 'pino';

export const loggerOptions: LoggerOptions = {
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  formatters: {
    level: (label) => {
      return { level: pino.levels.values[label] };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Remove serializers to prevent nested structures - we'll handle flattening manually
  serializers: {},
};

export const baseLogger = pino(loggerOptions);

const flattenObject = (obj: any, prefix: string = ''): any => {
  const flattened: any = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}_${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      // Recursively flatten nested objects
      Object.assign(flattened, flattenObject(value, newKey));
    } else {
      flattened[newKey] = value;
    }
  }

  return flattened;
};

const createLoggerWithOverride = (logger: Logger) => {
  return {
    warn: (message: string, arg?: any, ...args: any[]) => {
      const flattenedArg = arg ? flattenObject(arg) : {};
      const flattenedArgs = args.length > 0 ? flattenObject({ extraData: args }) : {};
      const logObj = { ...flattenedArg, ...flattenedArgs, msg: message };
      logger.warn(logObj);
    },
    info: (message: string, arg?: any) => {
      const flattenedArg = arg ? flattenObject(arg) : {};
      const logObj = { ...flattenedArg, msg: message };
      logger.info(logObj);
    },
    error: (message: string, arg?: any, ...args: any[]) => {
      const flattenedArg = arg ? flattenObject(arg) : {};
      const flattenedArgs = args.length > 0 ? flattenObject({ extraData: args }) : {};
      const logObj = { ...flattenedArg, ...flattenedArgs, msg: message };
      logger.error(logObj);
    },
    debug: (message: string, arg?: any) => {
      const flattenedArg = arg ? flattenObject(arg) : {};
      const logObj = { ...flattenedArg, msg: message };
      logger.debug(logObj);
    },
  };
};

export const logger = createLoggerWithOverride(baseLogger);
