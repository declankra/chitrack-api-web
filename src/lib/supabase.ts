import { createClient } from '@supabase/supabase-js';

let supabase: any;

export const getSupabase = (): any => {
  if (supabase) return supabase;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase URL or anonymous key.');
  }

  supabase = createClient<any>(supabaseUrl, supabaseAnonKey);
  return supabase;
};
