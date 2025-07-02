import dotenv from 'dotenv';
dotenv.config();

export const {
  PORT,
  API_VERSION,
  CREDENTIALS,
  FRONTEND_ORIGIN,
  DATABASE_URL,
  STRIPE_API_KEY,
  STRIPE_SUBSCRIPTION_WEBHOOK_SECRET,
  STRIPE_PRICE_ID,
  API_URL,
  PLAID_CLIENT_ID,
  PLAID_SECRET,
  NODE_ENV,
  DB_SCHEMA,
  // SEQ Configuration
  SEQ_SERVER_URL,
  SEQ_API_KEY,
} = process.env;

export const IS_PRODUCTION = NODE_ENV === 'production';
export const IS_DEVELOPMENT = NODE_ENV === 'development';
export const IS_LOCAL = NODE_ENV === 'local';
export const IS_HOSTED = IS_PRODUCTION || IS_DEVELOPMENT;

// Default schema name if not provided
export const DATABASE_SCHEMA = DB_SCHEMA || 'dripiq_app';
