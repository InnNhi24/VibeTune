-- VibeTune Database Auth Fix Script
-- Run this in Supabase SQL Editor to fix authentication bounce-back issues

-- Step 1: Check for existing problematic triggers
DO $$
BEGIN
    -- Drop any existing problematic triggers that might be failing
    IF EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'on_auth_user_created' 
        AND tgrelid = 'auth.users'::regclass
    ) THEN
        DROP TRIGGER on_auth_user_created ON auth.users;
        RAISE NOTICE 'Dropped existing on_auth_user_created trigger';
    END IF;
END $$;

-- Step 2: Create a safe handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    -- VibeTune uses in-memory profiles, so we don't need to create database profiles
    -- Just log the user creation and return successfully
    RAISE LOG 'New user created: %', NEW.id;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- If anything fails, log it but don't block user creation
        RAISE LOG 'handle_new_user error (non-blocking): %', SQLERRM;
        RETURN NEW;
END;
$$ language plpgsql security definer;

-- Step 3: Create a safe trigger that won't fail
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 4: Ensure kv_store table exists for the app
CREATE TABLE IF NOT EXISTS public.kv_store_b2083953 (
    key text PRIMARY KEY,
    value jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Step 5: Set up RLS on kv_store
ALTER TABLE public.kv_store_b2083953 ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow all operations on kv_store" ON public.kv_store_b2083953;

-- Create a permissive policy for the app
CREATE POLICY "Allow all operations on kv_store" ON public.kv_store_b2083953
    FOR ALL USING (true) WITH CHECK (true);

-- Step 6: Create tables for VibeTune if needed (optional - app works without these)
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    preferences jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on user_preferences
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Create policy for user_preferences
CREATE POLICY "Users can manage their own preferences" ON public.user_preferences
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Step 7: Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.kv_store_b2083953 TO anon, authenticated;
GRANT ALL ON public.user_preferences TO authenticated;

-- Step 8: Create a test function to verify the setup
CREATE OR REPLACE FUNCTION public.test_auth_setup()
RETURNS json AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'kv_store_exists', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'kv_store_b2083953'),
        'user_preferences_exists', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'user_preferences'),
        'handle_new_user_exists', EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user'),
        'trigger_exists', EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'),
        'rls_enabled_kv', (SELECT relrowsecurity FROM pg_class WHERE relname = 'kv_store_b2083953'),
        'timestamp', now()
    ) INTO result;
    
    RETURN result;
END;
$$ language plpgsql security definer;

-- Test the setup
SELECT public.test_auth_setup() as setup_status;

-- Final verification query
SELECT 
    'Database setup complete' as status,
    (SELECT count(*) FROM pg_trigger WHERE tgname = 'on_auth_user_created') as trigger_count,
    (SELECT count(*) FROM information_schema.tables WHERE table_name = 'kv_store_b2083953') as kv_table_count;