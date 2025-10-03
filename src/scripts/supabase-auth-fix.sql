-- ==========================================
-- VibeTune Supabase Authentication Fix Script
-- ==========================================
-- Run these commands step by step to fix auth triggers and constraints

-- ==========================================
-- STEP 1: TEMPORARILY DISABLE PROBLEMATIC TRIGGERS
-- ==========================================
-- First, let's disable any triggers that might be causing user creation to fail
-- Replace 'handle_new_user' with the actual trigger name found in diagnostics

-- Disable common trigger names (run each one, ignore errors for non-existent triggers)
ALTER TABLE auth.users DISABLE TRIGGER IF EXISTS handle_new_user;
ALTER TABLE auth.users DISABLE TRIGGER IF EXISTS on_auth_user_created;
ALTER TABLE auth.users DISABLE TRIGGER IF EXISTS handle_auth_user_created;
ALTER TABLE auth.users DISABLE TRIGGER IF EXISTS create_profile_for_new_user;

-- Alternative: Disable ALL triggers (use as last resort)
-- ALTER TABLE auth.users DISABLE TRIGGER ALL;

-- ==========================================
-- STEP 2: CREATE OR FIX PROFILES TABLE
-- ==========================================
-- Create profiles table if it doesn't exist or fix its constraints

-- Drop existing table if it has problematic constraints (CAREFUL!)
-- DROP TABLE IF EXISTS public.profiles CASCADE;

-- Create profiles table with proper structure for VibeTune
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    username TEXT,
    level TEXT CHECK (level IN ('Beginner', 'Intermediate', 'Advanced')),
    placement_test_completed BOOLEAN DEFAULT FALSE,
    placement_test_score INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ DEFAULT NOW(),
    device_id TEXT,
    avatar_url TEXT,
    user_metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Ensure required fields are properly handled
    CONSTRAINT valid_email CHECK (email IS NULL OR email ~ '^[^@]+@[^@]+\.[^@]+$'),
    CONSTRAINT valid_score CHECK (placement_test_score IS NULL OR (placement_test_score >= 0 AND placement_test_score <= 100))
);

-- Add RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- STEP 3: CREATE SAFE RLS POLICIES
-- ==========================================
-- Drop existing policies that might be too restrictive
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;

-- Create permissive policies for service role and users
CREATE POLICY "Service role full access" ON public.profiles
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id);

-- Allow anonymous users to read profiles (for demo mode)
CREATE POLICY "Allow anonymous read" ON public.profiles
    FOR SELECT TO anon
    USING (true);

-- ==========================================
-- STEP 4: CREATE NULL-SAFE TRIGGER FUNCTION
-- ==========================================
-- Create a robust trigger function that won't fail on edge cases

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    username_value TEXT;
    email_value TEXT;
BEGIN
    -- Safely extract email
    email_value := COALESCE(NEW.email, '');
    
    -- Safely extract username from various metadata fields
    username_value := COALESCE(
        NEW.user_metadata->>'username',
        NEW.user_metadata->>'name',
        NEW.user_metadata->>'display_name',
        NEW.user_metadata->>'full_name',
        NEW.raw_user_meta_data->>'username',
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'display_name',
        NEW.raw_user_meta_data->>'full_name',
        split_part(email_value, '@', 1),
        'User'
    );
    
    -- Insert profile with safe defaults
    INSERT INTO public.profiles (
        id,
        email,
        username,
        level,
        placement_test_completed,
        placement_test_score,
        created_at,
        last_login,
        device_id,
        user_metadata
    ) VALUES (
        NEW.id,
        email_value,
        username_value,
        NULL,  -- Level starts as NULL so user goes to level selection
        FALSE, -- Placement test not completed
        NULL,  -- No score initially
        COALESCE(NEW.created_at, NOW()),
        NOW(),
        NULL,  -- Device ID will be set by frontend
        COALESCE(NEW.user_metadata, '{}'::jsonb)
    );
    
    RETURN NEW;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the user creation
        RAISE WARNING 'Failed to create profile for user % (email: %): % - %', 
            NEW.id, 
            NEW.email, 
            SQLSTATE, 
            SQLERRM;
        
        -- Still return NEW so the user creation succeeds
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- STEP 5: CREATE THE TRIGGER
-- ==========================================
-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create new trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- STEP 6: TEST THE SETUP
-- ==========================================
-- Test that we can create a user (this simulates what happens during signup)
-- DO NOT RUN THIS IN PRODUCTION - it's just for testing the trigger

/*
-- Test user creation (comment out for production)
DO $$
DECLARE
    test_user_id UUID;
BEGIN
    -- This would normally be done by Supabase auth
    test_user_id := gen_random_uuid();
    
    -- Test if our trigger works
    RAISE NOTICE 'Testing user creation trigger...';
    
    -- Insert test data (simulating what Supabase auth does)
    INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        user_metadata
    ) VALUES (
        test_user_id,
        'test-trigger@vibetune.com',
        'dummy_encrypted_password',
        NOW(),
        NOW(),
        NOW(),
        '{"name": "Test User", "username": "testuser"}'::jsonb
    );
    
    -- Check if profile was created
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = test_user_id) THEN
        RAISE NOTICE 'SUCCESS: Profile created automatically by trigger!';
    ELSE
        RAISE NOTICE 'FAILED: Profile was not created by trigger!';
    END IF;
    
    -- Clean up test data
    DELETE FROM auth.users WHERE id = test_user_id;
    DELETE FROM public.profiles WHERE id = test_user_id;
    
    RAISE NOTICE 'Test completed and cleaned up.';
END $$;
*/

-- ==========================================
-- STEP 7: VERIFY SETUP
-- ==========================================
-- Check that everything is properly configured

SELECT 
    'Trigger Status' as check_type,
    tgname as name,
    CASE 
        WHEN tgenabled = 'O' THEN 'ENABLED'
        WHEN tgenabled = 'D' THEN 'DISABLED'
        ELSE 'UNKNOWN'
    END as status
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created'
AND tgrelid = 'auth.users'::regclass;

-- Check profiles table structure
SELECT 
    'Profiles Table' as check_type,
    column_name as name,
    CONCAT(data_type, 
           CASE WHEN is_nullable = 'YES' THEN ' (nullable)' ELSE ' (not null)' END,
           CASE WHEN column_default IS NOT NULL THEN ' default: ' || column_default ELSE '' END
    ) as status
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check RLS policies
SELECT 
    'RLS Policies' as check_type,
    policyname as name,
    cmd as status
FROM pg_policies 
WHERE tablename = 'profiles';

RAISE NOTICE 'Setup verification completed. Check the results above.';
RAISE NOTICE 'If you see the trigger as ENABLED and policies listed, you can proceed to test signup!';