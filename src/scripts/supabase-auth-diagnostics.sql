-- ==========================================
-- VibeTune Supabase Authentication Diagnostics
-- ==========================================
-- Run these queries in your Supabase SQL Editor to diagnose auth issues

-- Step 1: Check recent users in auth.users table
SELECT 
    id, 
    email, 
    created_at, 
    email_confirmed_at, 
    last_sign_in_at, 
    user_metadata,
    raw_user_meta_data
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- Step 2: Find triggers on auth.users table
SELECT 
    tgname AS trigger_name, 
    tgrelid::regclass AS table_name, 
    tgfoid::regprocedure AS function_name,
    tgenabled AS enabled,
    tgtype AS trigger_type
FROM pg_trigger
WHERE NOT tgisinternal 
AND tgrelid::regclass::text LIKE '%users%'
ORDER BY tgname;

-- Step 3: Check if public.profiles table exists and its structure
SELECT 
    table_name,
    column_name, 
    is_nullable, 
    column_default,
    data_type,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 4: Check RLS policies on profiles table (if it exists)
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
WHERE tablename = 'profiles'
ORDER BY policyname;

-- Step 5: Check for recent auth-related errors in logs
-- (This might not show in SQL editor, but useful for reference)
-- Check Supabase Dashboard → Logs → Database for errors around user creation

-- Step 6: Test basic auth functions
SELECT 
    proname as function_name,
    prosrc as function_source
FROM pg_proc 
WHERE proname LIKE '%user%' 
OR proname LIKE '%profile%'
OR proname LIKE '%auth%'
ORDER BY proname;

-- Step 7: Check current database and schema
SELECT current_database(), current_schema();

-- Step 8: Look for any custom types that might be causing issues
SELECT 
    typname,
    typtype,
    typowner
FROM pg_type 
WHERE typname LIKE '%profile%' 
OR typname LIKE '%user%';