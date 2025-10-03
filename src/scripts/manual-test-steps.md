# VibeTune Authentication Manual Testing Guide

## 🧪 **Step-by-Step Testing Process**

### Phase 1: Environment Preparation
1. **Clear all browser data**:
   ```javascript
   // Run in browser console:
   localStorage.clear();
   sessionStorage.clear();
   // Then clear cookies for your domain
   ```

2. **Check Supabase project settings**:
   - Go to Supabase Dashboard → Settings → Auth
   - Verify Site URL matches your domain
   - Check redirect URLs include your domain

3. **Run database fixes**:
   - Execute `/scripts/supabase-auth-diagnostics.sql` first
   - Then execute `/scripts/supabase-auth-fix.sql`
   - Finally run `/scripts/test-auth-flow.sql`

### Phase 2: Email/Password Signup Test
1. **Open your VibeTune app**
2. **Click "Get Started"** → **"Create Account"**
3. **Fill signup form**:
   - Email: `test-signup-$(random)@example.com`
   - Password: `TestPassword123!`
   - Username: `TestUser`
4. **Submit form and observe**:
   - ✅ **Expected**: Successful signup, redirect to level selection
   - ❌ **Problem**: Bounce back to onboarding

### Phase 3: Email/Password Login Test
1. **Try logging in** with the account created above
2. **Click "Sign In"** from onboarding
3. **Enter credentials** and submit
4. **Observe behavior**:
   - ✅ **Expected**: Successful login, user goes to main app or level selection
   - ❌ **Problem**: Bounce back to onboarding

### Phase 4: OAuth Testing (if configured)
1. **Clear browser data** again
2. **Click OAuth button** (Google/GitHub)
3. **Complete OAuth flow** on provider site
4. **Observe return to app**:
   - ✅ **Expected**: Successful OAuth, redirect to level selection
   - ❌ **Problem**: Error or bounce back

### Phase 5: Session Persistence Test
1. **After successful login/signup**
2. **Refresh the page** (F5 or Cmd+R)
3. **Observe behavior**:
   - ✅ **Expected**: User stays logged in, app loads normally
   - ❌ **Problem**: User gets logged out, returns to onboarding

## 🔍 **What to Check During Testing**

### Browser Console Logs
Look for these patterns:

**✅ Success Pattern:**
```
🚀 Starting VibeTune...
✅ Found existing session
🎯 Navigating to level selection (or main app)
📄 Rendering: Level Selection (or Main App)
```

**❌ Failure Patterns:**
```
❌ Supabase auth signup error: [error details]
⚠️ Session check failed: [error details]
🔄 Quick start - going to onboarding (fallback triggered)
```

### Network Tab
Check for failed requests:
- `POST /functions/v1/make-server-b2083953/signup` → Should return 200
- `GET /auth/v1/user` → Should return user data
- Any 500 errors indicate server-side issues

### Supabase Dashboard
Monitor in real-time:

1. **Authentication → Users**:
   - New users should appear immediately after signup
   - `email_confirmed_at` should be set (since we auto-confirm)

2. **Database → profiles**:
   - New profile row should appear for each new user
   - Check all fields are populated correctly

3. **Logs → Auth**:
   - Look for signup/login events
   - Check for any error messages

4. **Logs → Database**:
   - Look for trigger execution logs
   - Check for any constraint violations or errors

## 🐛 **Troubleshooting Common Issues**

### Issue 1: "Database error saving new user"
**Symptoms**: Backend returns 500 error during signup
**Diagnosis**: Run diagnostics SQL to check triggers
**Fix**: Apply the auth fix SQL script

### Issue 2: User created but profile missing
**Symptoms**: User appears in auth.users but not in profiles table
**Diagnosis**: Trigger function failing silently
**Fix**: Check trigger function for errors, apply fixed version

### Issue 3: Session not persisting
**Symptoms**: User logs in but gets logged out on refresh
**Diagnosis**: Frontend session handling issue
**Fix**: Check browser storage, verify auth state management

### Issue 4: OAuth redirect errors
**Symptoms**: OAuth returns to app with error parameters
**Diagnosis**: Misconfigured redirect URLs
**Fix**: Update Supabase auth settings and OAuth provider settings

## 📊 **Test Results Documentation**

Create a test log like this:

```
Date: 2024-01-15
Environment: Local Development / Production
Browser: Chrome 120

Test 1: Email Signup
- Email: test-user-001@example.com
- Result: ✅ Success / ❌ Failed
- Notes: [Any observations]

Test 2: Email Login
- Email: test-user-001@example.com
- Result: ✅ Success / ❌ Failed
- Notes: [Any observations]

Test 3: Session Persistence
- Action: Page refresh after login
- Result: ✅ Success / ❌ Failed
- Notes: [Any observations]

Test 4: OAuth (Google)
- Result: ✅ Success / ❌ Failed / ⏭️ Skipped
- Notes: [Any observations]

Database Verification:
- auth.users count: [number]
- profiles count: [number]
- Orphaned users: [number]

Overall Status: ✅ All tests passed / ❌ Issues found
```

## 🎯 **Success Criteria**

The authentication is working correctly when:

1. ✅ **New users can sign up** without errors
2. ✅ **Existing users can log in** without errors
3. ✅ **Sessions persist** across page refreshes
4. ✅ **Users reach level selection** (new users) or main app (returning users)
5. ✅ **No bounce-back** to onboarding after successful auth
6. ✅ **Database has matching records** in both auth.users and profiles
7. ✅ **No 500 errors** in backend logs
8. ✅ **OAuth works** (if configured)

## 🚀 **Post-Fix Verification**

After applying all fixes:

1. **Run the test flow** with at least 3 different email addresses
2. **Test both signup and login** paths
3. **Verify database state** matches expectations
4. **Check performance** - auth should complete within 2-3 seconds
5. **Test error handling** - try invalid credentials to ensure proper error messages
6. **Test demo user flow** - ensure demo mode still works for users who don't want to sign up

## 📞 **Getting Help**

If tests still fail after applying all fixes:

1. **Collect logs** from browser console, network tab, and Supabase dashboard
2. **Note exact error messages** and when they occur
3. **Document the user flow** that triggers the issue
4. **Check Supabase status page** for any service issues
5. **Verify your Supabase plan limits** (free tier has usage limits)