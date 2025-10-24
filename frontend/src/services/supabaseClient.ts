/**
 * VibeTune Supabase Client Configuration
 * 
 * Production-ready Supabase client with optimized settings for:
 * - Authentication with PKCE flow
 * - Real-time subscriptions
 * - Offline-first architecture
 * - Performance monitoring
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabaseUrl, publicAnonKey, isDevelopment } from '../utils/supabase/info';

// Enhanced Supabase client with VibeTune-specific configuration
export const supabase: SupabaseClient = createClient(supabaseUrl, publicAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'vibetune-auth',
    flowType: 'pkce',
    // Enhanced auth settings for mobile/web
    debug: isDevelopment
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  global: {
    headers: {
      'X-Client-Info': 'vibetune-web',
      'X-App-Version': '1.0.0'
    }
  },
  db: {
    schema: 'public'
  }
});

// Server-side client factory (for use with service role key)
// NOTE: server-only Supabase clients (using the service role key) should live
// in backend code (for example: `backend/src/clients/supabase.ts`) or in
// serverless functions. Keeping a service-role client in frontend code risks
// leaking secrets into the browser bundle.

// Database types
export interface Profile {
  id: string;
  email: string;
  username: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced' | null;
  placement_test_completed?: boolean;
  placement_test_score?: number;
  created_at: string;
  last_login?: string;
  device_id?: string;
  avatar_url?: string;
}

export interface Conversation {
  id: string;
  profile_id: string;
  topic: string;
  is_placement_test: boolean;
  started_at: string;
  ended_at?: string;
  metadata?: any;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender: 'user' | 'ai';
  type: 'text' | 'audio';
  content: string;
  audio_url?: string;
  prosody_feedback?: {
    score: number;
    highlights: Array<{
      text: string;
      type: 'error' | 'good' | 'suggestion';
      feedback: string;
    }>;
    suggestions: string[];
    vocabulary?: Array<{
      word: string;
      definition: string;
      example: string;
    }>;
  };
  vocab_suggestions?: string[];
  guidance?: string;
  created_at: string;
  retry_of_message_id?: string;
  version: number;
  device_id?: string;
}

export interface AnalyticsEvent {
  id: string;
  profile_id: string;
  event_type: string;
  metadata: any;
  created_at: string;
}

// Helper function to get current user
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Helper function to get user profile
export const getUserProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  return { data, error };
};