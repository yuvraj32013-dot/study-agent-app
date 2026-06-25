import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!url) {
    throw new Error('Missing Supabase URL environment variable. Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL.');
  }
  return url;
}

function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error('Missing Supabase anonymous key environment variable. Set NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY.');
  }
  return key;
}

export function createClient(): SupabaseClient {
  return createSupabaseClient(getSupabaseUrl(), getSupabaseAnonKey());
}
