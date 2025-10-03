-- ==========================================
-- VibeTune Authentication Flow Test Script
-- ==========================================
-- Run this after applying the fixes to verify everything works

-- ==========================================
-- STEP 1: VERIFY CURRENT STATE
-- ==========================================
-- Check if our trigger is enabled
SELECT 
    'Trigger Check' as test_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_trigger 
            WHERE tgname = 'on_auth_user_created' 
            AND tgrelid = 'auth.users'::regclass 
            AND tgenabled = 'O'
        ) THEN 'PASS: Trigger is enabled'
        ELSE 'FAIL: Trigger not found or disabled'
    END as result;

-- Check if profiles table exists with correct structure
SELECT 
    'Profiles Table Check' as test_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'profiles' 
            AND table_schema = 'public'
        ) THEN 'PASS: Profiles table exists'
        ELSE 'FAIL: Profiles table missing'
    END as result;

-- Check if RLS is enabled
SELECT 
    'RLS Check' as test_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE tablename = 'profiles' 
            AND schemaname = 'public' 
            AND rowsecurity = true
        ) THEN 'PASS: RLS is enabled'
        ELSE 'FAIL: RLS not enabled'
    END as result;

-- ==========================================
-- STEP 2: TEST USER CREATION SIMULATION
-- ==========================================
-- This simulates what happens when a user signs up

DO $$
DECLARE
    test_user_id UUID;
    profile_exists BOOLEAN;
    profile_data RECORD;
BEGIN
    -- Generate test user ID
    test_user_id := gen_random_uuid();
    
    RAISE NOTICE 'Starting auth flow test with user ID: %', test_user_id;
    
    -- Step 1: Simulate user creation in auth.users (what Supabase does)
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token,
        user_metadata,
        raw_user_meta_data
    ) VALUES (
        '00000000-0000-0000-0000-000000000000'::uuid,
        test_user_id,
        'authenticated',
        'authenticated',
        'test-user@vibetune.com',
        crypt('testpassword123', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '',
        '',
        '',
        '',
        '{"name": "Test User", "username": "testuser"}'::jsonb,
        '{"name": "Test User", "username": "testuser"}'::jsonb
    );
    
    RAISE NOTICE 'Test user created in auth.users';
    
    -- Step 2: Check if trigger created profile automatically
    SELECT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = test_user_id
    ) INTO profile_exists;
    
    IF profile_exists THEN
        -- Get profile data
        SELECT * INTO profile_data FROM public.profiles WHERE id = test_user_id;
        
        RAISE NOTICE 'SUCCESS: Profile created automatically!';
        RAISE NOTICE 'Profile details - Email: %, Username: %, Level: %, Test Completed: %',
            profile_data.email,
            profile_data.username,
            COALESCE(profile_data.level, 'NULL'),
            profile_data.placement_test_completed;
    ELSE
        RAISE NOTICE 'FAILED: Profile was not created automatically by trigger!';
    END IF;
    
    -- Step 3: Test profile update (simulating level selection)
    UPDATE public.profiles 
    SET 
        level = 'Intermediate',
        placement_test_completed = true,
        placement_test_score = 85
    WHERE id = test_user_id;
    
    RAISE NOTICE 'Profile update test completed';
    
    -- Step 4: Verify update worked
    SELECT * INTO profile_data FROM public.profiles WHERE id = test_user_id;
    
    RAISE NOTICE 'Updated profile - Level: %, Score: %',
        profile_data.level,
        profile_data.placement_test_score;
    
    -- Step 5: Clean up test data
    DELETE FROM public.profiles WHERE id = test_user_id;
    DELETE FROM auth.users WHERE id = test_user_id;
    
    RAISE NOTICE 'Test completed successfully and cleaned up!';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Test failed with error: % - %', SQLSTATE, SQLERRM;
        -- Attempt cleanup even on failure
        DELETE FROM public.profiles WHERE id = test_user_id;
        DELETE FROM auth.users WHERE id = test_user_id;
        RAISE;
END $$;

-- ==========================================
-- STEP 3: CHECK FOR RECENT SIGNUP ATTEMPTS
-- ==========================================
-- Look for recent users who might have failed during signup

SELECT 
    'Recent Users' as info_type,
    COUNT(*) as total_users,
    COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as users_last_24h,
    COUNT(CASE WHEN email_confirmed_at IS NULL THEN 1 END) as unconfirmed_users
FROM auth.users;

-- Check for orphaned auth.users (users without profiles)
SELECT 
    'Orphaned Users Check' as info_type,
    COUNT(*) as orphaned_count
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- Show recent orphaned users if any
SELECT 
    au.id,
    au.email,
    au.created_at,
    au.user_metadata,
    'MISSING PROFILE' as issue
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL
AND au.created_at > NOW() - INTERVAL '7 days'
ORDER BY au.created_at DESC
LIMIT 5;

-- ==========================================
-- STEP 4: ENVIRONMENT CHECK
-- ==========================================
-- Check current database settings that might affect auth
SELECT 
    name,
    setting,
    context,
    short_desc
FROM pg_settings
WHERE name IN (
    'log_statement',
    'log_min_error_statement',
    'timezone',
    'default_transaction_isolation'
);

RAISE NOTICE 'Authentication flow test completed! Check the results above.';
RAISE NOTICE 'If all tests passed, your signup/login should now work correctly.';
RAISE NOTICE 'Next steps:';
RAISE NOTICE '1. Test signup/login in your frontend application';
RAISE NOTICE '2. Check browser console for any remaining errors';
RAISE NOTICE '3. Monitor Supabase logs during testing';