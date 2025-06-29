import { FastifySchemaValidationError } from 'fastify/types/schema';
import { logger } from '@/libs/logger';

export const schemaErrorFormatter = (errors: FastifySchemaValidationError[]) => {
  if (errors.length === 0) {
    return new Error('Validation failed: No errors found.');
  }

  logger.error('ERROR: ', errors);

  const firstError = errors[0];
  const instancePath = firstError?.instancePath.substring(1) ?? '';
  const message = firstError?.message ?? '';
  const formattedError = `${instancePath}${instancePath ? ':\n' : '\n'}\n${message}`;

  return new Error(formattedError);
};
