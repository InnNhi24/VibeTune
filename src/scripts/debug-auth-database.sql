-- VibeTune Auth Database Debugging Script
-- Run these queries in Supabase SQL Editor to diagnose auth issues

-- 1. Check recent auth.users entries
SELECT 
  id, 
  email, 
  created_at, 
  email_confirmed_at,
  last_sign_in_at,
  confirmation_sent_at
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 10;

-- 2. Check for triggers on auth.users
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgfoid::regprocedure as function_name,
  tgenabled
FROM pg_trigger 
WHERE NOT tgisinternal 
  AND tgrelid::regclass::text LIKE '%users%'
ORDER BY tgname;

-- 3. Check for any profiles table
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Check RLS policies on profiles table (if it exists)
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'profiles';

-- 5. Check for any functions that might be called by triggers
SELECT 
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_result(p.oid) as return_type,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname LIKE '%user%' OR p.proname LIKE '%profile%'
ORDER BY function_name;

-- 6. Check if kv_store table exists and has proper structure
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'kv_store_b2083953'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 7. Check for any recent database errors in logs
-- (This needs to be checked in Supabase Dashboard -> Logs -> Database)

-- POTENTIAL FIXES:

-- Fix 1: Create a safe handle_new_user function if it doesn't exist
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Just return NEW without trying to insert into profiles
  -- Since VibeTune uses in-memory profiles, we don't need database profiles
  RETURN NEW;
END;
$$ language plpgsql security definer;

-- Fix 2: If there's a failing trigger, we can disable it temporarily
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Fix 3: Or recreate the trigger to do nothing harmful
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Fix 4: Ensure kv_store table exists for the app
CREATE TABLE IF NOT EXISTS public.kv_store_b2083953 (
  key text PRIMARY KEY,
  value jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on kv_store
ALTER TABLE public.kv_store_b2083953 ENABLE ROW LEVEL SECURITY;

-- Create policy for kv_store access
CREATE POLICY "Allow all operations on kv_store" ON public.kv_store_b2083953
  FOR ALL USING (true) WITH CHECK (true);