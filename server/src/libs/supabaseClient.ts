import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase URL or anon key is missing. Make sure to set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file.'
  );
}

// Regular client for all operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
