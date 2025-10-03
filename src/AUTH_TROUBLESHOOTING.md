# VibeTune Authentication Troubleshooting Guide

## Current Issue
Users experience authentication bounce-back to onboarding screen after signup/login with the error:
- Server: `/callback | 500: Database error saving new user`
- Frontend: `hasUser: false, userId: undefined, session check skipped`

## Root Cause Analysis
The issue is likely caused by a database trigger on `auth.users` that fails when creating new users. This is a common Supabase issue where:

1. User gets created in `auth.users` table
2. A trigger tries to create a profile in `public.profiles` table
3. The trigger fails due to missing table, RLS policy, or constraint issues
4. This causes a 500 error but the user still exists in auth
5. Frontend can't complete the auth flow properly

## Step-by-Step Fix

### 1. Inspect Supabase Configuration

First, check your Supabase project settings:

**Navigate to**: Supabase Dashboard → Settings → API

**Remove these deprecated environment variables if present:**
- `GOTRUE_JWT_DEFAULT_GROUP_NAME`
- `GOTRUE_JWT_ADMIN_GROUP_NAME`

**Verify these settings:**
- Site URL: Should match your frontend domain (e.g., `http://localhost:3000` for dev)
- Redirect URLs: Should include your domain and any callback URLs

### 2. Check Auth Users Table

**Navigate to**: Supabase Dashboard → Table Editor → auth → users

**Run this query** in SQL Editor:
```sql
SELECT id, email, created_at, email_confirmed_at, last_sign_in_at 
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 10;
```

**Expected result**: You should see user records being created even when signup fails.

### 3. Inspect Database Triggers and Functions

**Run this query** in SQL Editor to check for problematic triggers:
```sql
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgfoid::regprocedure as function_name
FROM pg_trigger 
WHERE NOT tgisinternal 
    AND tgrelid::regclass::text LIKE '%users%';
```

**Common problematic triggers:**
- `on_auth_user_created` on `auth.users`
- Any trigger calling `handle_new_user()` function

### 4. Check Database Logs

**Navigate to**: Supabase Dashboard → Logs → Database

**Filter by**: "error"

**Look for errors like:**
- `relation "public.profiles" does not exist`
- `null value in column violates not-null constraint`
- `permission denied for relation profiles`

### 5. Apply Database Fix

**Run the complete fix script** in SQL Editor:

Copy and execute the content from `/scripts/fix-auth-database.sql`

This script will:
- Remove problematic triggers
- Create safe replacements
- Set up required tables
- Configure proper RLS policies

### 6. Update Supabase Environment Variables

**Check these environment variables are set:**

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**For OAuth (if using):**
- Google/GitHub OAuth must be configured in Supabase Dashboard → Authentication → Providers

### 7. Test the Fix

1. **Clear browser storage** (localStorage, sessionStorage, cookies)
2. **Try creating a new account** with a fresh email
3. **Check server logs** for any remaining errors
4. **Verify user creation** in auth.users table

### 8. Verify Frontend Handles Auth State

The current frontend code should handle the auth flow correctly. If you still have issues:

1. **Check browser console** for authentication errors
2. **Verify the session check** is completing
3. **Ensure onAuthComplete** is being called with valid profile data

## Additional Troubleshooting

### If OAuth is not working:
1. Configure providers in Supabase Dashboard → Authentication → Providers
2. Set correct redirect URLs
3. Add provider client IDs and secrets

### If email confirmation is required:
1. Configure SMTP in Supabase Dashboard → Authentication → Email Templates
2. Or use the `email_confirm: true` flag in server signup (already implemented)

### If RLS is blocking operations:
1. Check policies on all tables
2. Ensure service role key is used for admin operations
3. Verify anon key permissions for public operations

## Testing Commands

Run these in SQL Editor to test the fix:

```sql
-- Test the setup
SELECT public.test_auth_setup();

-- Check user creation works
SELECT COUNT(*) FROM auth.users WHERE created_at > NOW() - INTERVAL '1 hour';

-- Test kv_store access
INSERT INTO public.kv_store_b2083953 (key, value) 
VALUES ('test_key', '{"test": true}');

SELECT * FROM public.kv_store_b2083953 WHERE key = 'test_key';
```

## Expected Behavior After Fix

1. **Signup**: User creation succeeds without 500 errors
2. **Login**: Users can sign in and reach level selection
3. **Frontend**: Shows proper user state and navigation
4. **Database**: Users appear in auth.users without errors

## Contact Support

If the issue persists after following this guide:

1. **Share the exact error messages** from database logs
2. **Provide the output** of the test queries above
3. **Include browser console logs** during authentication
4. **Verify the database schema** matches expectations

The fix script should resolve 90% of authentication bounce-back issues in Supabase applications.