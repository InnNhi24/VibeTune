# VibeTune Supabase Environment Configuration Check

## 🔍 Environment Variables to Check/Remove

### ❌ **Remove These Deprecated Variables**
If these exist in your Supabase project settings, remove them:
```
GOTRUE_JWT_DEFAULT_GROUP_NAME
GOTRUE_JWT_ADMIN_GROUP_NAME
```

### ✅ **Verify These Required Variables**
Make sure these are correctly set in your Supabase project:

```bash
# Site URL (should match your frontend domain)
SITE_URL=http://localhost:3000  # for development
# OR
SITE_URL=https://yourdomain.com  # for production

# Additional redirect URLs (comma-separated)
ADDITIONAL_REDIRECT_URLS=http://localhost:3000,https://yourdomain.com

# JWT settings (should be defaults)
JWT_EXPIRY=3600
JWT_DEFAULT_GROUP_NAME=authenticated

# Email settings (if using email confirmation)
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_SENDER_NAME=VibeTune
```

## 🔧 **OAuth Provider Setup**

### Google OAuth
If using Google sign-in, verify in your Supabase Dashboard:

1. **Authentication → Providers → Google**
2. **Client ID**: Your Google OAuth client ID
3. **Client Secret**: Your Google OAuth client secret
4. **Redirect URL**: Should be automatically set to:
   ```
   https://your-project-ref.supabase.co/auth/v1/callback
   ```

### GitHub OAuth
If using GitHub sign-in, verify in your Supabase Dashboard:

1. **Authentication → Providers → GitHub**
2. **Client ID**: Your GitHub OAuth app client ID
3. **Client Secret**: Your GitHub OAuth app client secret
4. **Redirect URL**: Should be automatically set to:
   ```
   https://your-project-ref.supabase.co/auth/v1/callback
   ```

## 📋 **How to Check Your Current Settings**

### In Supabase Dashboard:
1. Go to **Settings → API**
2. Check your project URL and keys
3. Go to **Settings → Auth**
4. Verify Site URL and redirect URLs
5. Check provider configurations

### Your Current Project Info:
Based on your code, your project details are:
- **Project ID**: `qwvxgdrhjtgqwwksqebf`
- **Project URL**: `https://qwvxgdrhjtgqwwksqebf.supabase.co`

## 🚨 **Common Issues and Fixes**

### Issue 1: Wrong Site URL
**Problem**: Users get redirected to wrong domain after OAuth
**Fix**: Set `SITE_URL` to match your actual frontend domain

### Issue 2: Missing Redirect URLs
**Problem**: OAuth fails with "redirect_uri mismatch"
**Fix**: Add all your domains to `ADDITIONAL_REDIRECT_URLS`

### Issue 3: Deprecated JWT Variables
**Problem**: Auth tokens have wrong format or permissions
**Fix**: Remove `GOTRUE_JWT_DEFAULT_GROUP_NAME` and `GOTRUE_JWT_ADMIN_GROUP_NAME`

## ✅ **Verification Checklist**

- [ ] Removed deprecated JWT environment variables
- [ ] Set correct SITE_URL for your environment
- [ ] Added all redirect URLs to ADDITIONAL_REDIRECT_URLS
- [ ] OAuth providers configured with correct client ID/secret
- [ ] OAuth redirect URLs match Supabase callback URL
- [ ] Database triggers are fixed (run the SQL scripts)
- [ ] RLS policies allow profile creation
- [ ] Test signup/login flow works end-to-end

## 🔄 **Testing Your Configuration**

1. **Clear browser storage** (localStorage, sessionStorage, cookies)
2. **Try email/password signup** with a new email
3. **Try OAuth signup** (Google/GitHub if configured)
4. **Check browser console** for any errors
5. **Verify in Supabase Dashboard**:
   - New user appears in Authentication → Users
   - New profile appears in Database → profiles table
   - No errors in Logs → Auth or Logs → Database

## 📞 **If Issues Persist**

1. Check **Supabase Dashboard → Logs → Auth** for auth-specific errors
2. Check **Supabase Dashboard → Logs → Database** for database errors
3. Run the diagnostic SQL scripts provided
4. Verify your frontend is using the correct Supabase URL and keys
5. Test with a completely fresh browser/incognito window