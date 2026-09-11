import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const isSupabaseConfigured = () => Boolean(supabase);

export const APP_REDIRECT_URL = 'https://rewear-frontend-4k4i.vercel.app/auth/callback';

export const getRedirectUrl = () => {
  if (typeof window !== 'undefined' && window.location.origin) {
    return `${window.location.origin}/auth/callback`;
  }
  return APP_REDIRECT_URL;
};

export const signInWithGoogle = async () => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.');
  }

  const redirectTo = getRedirectUrl();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent'
      }
    }
  });

  if (error) throw error;
  return data;
};

