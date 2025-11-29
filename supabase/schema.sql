-- VibeTune Complete Database Schema
-- Simple and clean version for fresh database setup

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLES
-- ============================================================================

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  username TEXT,
  full_name TEXT,
  dob DATE,
  timezone TEXT,
  country TEXT,
  native_language TEXT,
  learning_goal TEXT,
  level TEXT CHECK (level IN ('Beginner', 'Intermediate', 'Advanced')),
  placement_test_completed BOOLEAN DEFAULT FALSE,
  placement_test_score INTEGER CHECK (placement_test_score IS NULL OR (placement_test_score >= 0 AND placement_test_score <= 100)),
  avatar_url TEXT,
  device_id TEXT,
  last_login TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  title TEXT,
  is_placement_test BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  topic_confidence FLOAT4,
  topic_slug TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT conversations_dates_check CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'ai')),
  type TEXT NOT NULL CHECK (type IN ('text', 'audio')),
  content TEXT NOT NULL,
  audio_url TEXT,
  transcript TEXT,
  prosody_feedback JSONB,
  vocab_suggestions JSONB,
  guidance TEXT,
  tags JSONB,
  try_again BOOLEAN DEFAULT FALSE,
  suggested_utterance TEXT,
  tts_url TEXT,
  error JSONB,
  meta JSONB,
  scores JSONB,
  retry_of_message_id UUID REFERENCES public.messages(id),
  version INTEGER DEFAULT 1 CHECK (version >= 1),
  device_id TEXT,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics events table
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  session_id TEXT,
  device_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback ratings table
CREATE TABLE IF NOT EXISTS public.feedback_rating (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Key-value store for caching
CREATE TABLE IF NOT EXISTS public.kv_store_bc083953 (
  key TEXT PRIMARY KEY,
  value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_level_created ON public.profiles(level, created_at DESC);

-- Conversations indexes
CREATE INDEX IF NOT EXISTS idx_conversations_profile_id ON public.conversations(profile_id);
CREATE INDEX IF NOT EXISTS idx_conversations_started_at ON public.conversations(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_profile_started ON public.conversations(profile_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_topic_status ON public.conversations(topic, status);
CREATE INDEX IF NOT EXISTS idx_conversations_topic_slug ON public.conversations(topic_slug);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_active ON public.conversations(profile_id, started_at DESC) WHERE ended_at IS NULL;

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_profile_id ON public.messages(profile_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_type ON public.messages(sender, type);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_user_with_prosody ON public.messages(conversation_id, created_at DESC) WHERE sender = 'user' AND prosody_feedback IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_prosody_feedback_gin ON public.messages USING gin(prosody_feedback);
CREATE INDEX IF NOT EXISTS idx_messages_vocab_suggestions_gin ON public.messages USING gin(vocab_suggestions);
CREATE INDEX IF NOT EXISTS idx_messages_tags ON public.messages USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_messages_content_search ON public.messages USING gin(to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_messages_transcript ON public.messages USING gin(to_tsvector('english', transcript));

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_analytics_events_profile_id ON public.analytics_events(profile_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON public.analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_profile_event_created ON public.analytics_events(profile_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_metadata_gin ON public.analytics_events USING gin(metadata);

-- Feedback indexes
CREATE INDEX IF NOT EXISTS idx_feedback_rating_message_id ON public.feedback_rating(message_id);
CREATE INDEX IF NOT EXISTS idx_feedback_rating_profile_id ON public.feedback_rating(profile_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-profile creation function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, username, level,
    placement_test_completed,
    created_at,
    last_login
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      NEW.raw_user_meta_data->>'display_name',
      split_part(NEW.email, '@', 1)
    ),
    'Beginner',
    FALSE,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    last_login = NOW();
  RETURN NEW;
END;
$$;

-- Conversation stats update function
CREATE OR REPLACE FUNCTION public.update_conversation_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.conversations
  SET updated_at = NOW()
  WHERE id = COALESCE(NEW.conversation_id, OLD.conversation_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Save complete chat interaction (fixed parameter order)
CREATE OR REPLACE FUNCTION public.save_chat_interaction(
  p_conversation_id UUID,
  p_profile_id UUID,
  p_user_message TEXT,
  p_ai_response TEXT,
  p_user_audio_url TEXT DEFAULT NULL,
  p_prosody_feedback JSONB DEFAULT NULL,
  p_vocab_suggestions JSONB DEFAULT NULL,
  p_guidance TEXT DEFAULT NULL,
  p_device_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_message_id UUID;
  ai_message_id UUID;
BEGIN
  -- Insert user message
  INSERT INTO public.messages (
    conversation_id, sender, type, content, audio_url, profile_id, device_id
  ) VALUES (
    p_conversation_id, 'user', 
    CASE WHEN p_user_audio_url IS NOT NULL THEN 'audio' ELSE 'text' END, 
    p_user_message, p_user_audio_url, p_profile_id, p_device_id
  ) RETURNING id INTO user_message_id;

  -- Insert AI response
  INSERT INTO public.messages (
    conversation_id, sender, type, content, prosody_feedback, vocab_suggestions, guidance, profile_id, device_id
  ) VALUES (
    p_conversation_id, 'ai', 'text', p_ai_response, p_prosody_feedback, p_vocab_suggestions, p_guidance, p_profile_id, p_device_id
  ) RETURNING id INTO ai_message_id;

  RETURN jsonb_build_object(
    'user_message_id', user_message_id, 
    'ai_message_id', ai_message_id, 
    'conversation_id', p_conversation_id, 
    'success', true
  );
END;
$$;

-- Create new conversation
CREATE OR REPLACE FUNCTION public.create_conversation(
  p_profile_id UUID,
  p_topic TEXT,
  p_is_placement_test BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  conversation_id UUID;
BEGIN
  INSERT INTO public.conversations (
    profile_id, topic, title, is_placement_test, status
  ) VALUES (
    p_profile_id, p_topic, p_topic, p_is_placement_test, 'active'
  ) RETURNING id INTO conversation_id;
  
  RETURN conversation_id;
END;
$$;

-- Track analytics event
CREATE OR REPLACE FUNCTION public.track_event(
  p_profile_id UUID,
  p_event_type TEXT,
  p_metadata JSONB DEFAULT '{}',
  p_session_id TEXT DEFAULT NULL,
  p_device_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO public.analytics_events (
    profile_id, event_type, metadata, session_id, device_id
  ) VALUES (
    p_profile_id, p_event_type, p_metadata, p_session_id, p_device_id
  ) RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Drop existing triggers safely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS conversations_updated_at ON public.conversations;
DROP TRIGGER IF EXISTS messages_updated_at ON public.messages;
DROP TRIGGER IF EXISTS update_conversation_stats_trigger ON public.messages;

-- Create triggers
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_conversation_stats_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_stats();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_rating ENABLE ROW LEVEL SECURITY;

-- Create all policies safely
DO $$ BEGIN

-- Profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Service role can manage all profiles" ON public.profiles;
CREATE POLICY "Service role can manage all profiles" ON public.profiles FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Conversations policies
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
CREATE POLICY "Users can view own conversations" ON public.conversations FOR SELECT USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Users can create own conversations" ON public.conversations;
CREATE POLICY "Users can create own conversations" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;
CREATE POLICY "Users can update own conversations" ON public.conversations FOR UPDATE USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Users can delete own conversations" ON public.conversations;
CREATE POLICY "Users can delete own conversations" ON public.conversations FOR DELETE USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Service role can manage all conversations" ON public.conversations;
CREATE POLICY "Service role can manage all conversations" ON public.conversations FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Messages policies
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON public.messages;
CREATE POLICY "Users can view messages in own conversations" ON public.messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE conversations.id = messages.conversation_id 
    AND conversations.profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can create messages in own conversations" ON public.messages;
CREATE POLICY "Users can create messages in own conversations" ON public.messages FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE conversations.id = messages.conversation_id 
    AND conversations.profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update messages in own conversations" ON public.messages;
CREATE POLICY "Users can update messages in own conversations" ON public.messages FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE conversations.id = messages.conversation_id 
    AND conversations.profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete messages in own conversations" ON public.messages;
CREATE POLICY "Users can delete messages in own conversations" ON public.messages FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE conversations.id = messages.conversation_id 
    AND conversations.profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Service role can manage all messages" ON public.messages;
CREATE POLICY "Service role can manage all messages" ON public.messages FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Analytics policies
DROP POLICY IF EXISTS "Users can view own analytics" ON public.analytics_events;
CREATE POLICY "Users can view own analytics" ON public.analytics_events FOR SELECT USING (auth.uid() = profile_id OR profile_id IS NULL);

DROP POLICY IF EXISTS "Users can create own analytics" ON public.analytics_events;
CREATE POLICY "Users can create own analytics" ON public.analytics_events FOR INSERT WITH CHECK (auth.uid() = profile_id OR profile_id IS NULL);

DROP POLICY IF EXISTS "Service role can manage all analytics" ON public.analytics_events;
CREATE POLICY "Service role can manage all analytics" ON public.analytics_events FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Feedback policies
DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback_rating;
CREATE POLICY "Users can view own feedback" ON public.feedback_rating FOR SELECT USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Users can create own feedback" ON public.feedback_rating;
CREATE POLICY "Users can create own feedback" ON public.feedback_rating FOR INSERT WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Users can update own feedback" ON public.feedback_rating;
CREATE POLICY "Users can update own feedback" ON public.feedback_rating FOR UPDATE USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Service role can manage all feedback" ON public.feedback_rating;
CREATE POLICY "Service role can manage all feedback" ON public.feedback_rating FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

END $$;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ VibeTune database schema setup completed successfully!';
  RAISE NOTICE '📊 Tables: profiles, conversations, messages, analytics_events, feedback_rating, kv_store_bc083953';
  RAISE NOTICE '🔐 Row Level Security enabled with proper access controls';
  RAISE NOTICE '⚡ Performance indexes and triggers configured';
  RAISE NOTICE '🚀 Your VibeTune app is ready to use!';
END $$;