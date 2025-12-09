# 🚀 VibeTune Deployment Guide

## Prerequisites

- Vercel account
- Supabase project
- OpenAI API key
- GitHub repository

---

## 1. Supabase Setup

### Create Project

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Save your project URL and keys

### Apply Database Schema

1. Open SQL Editor in Supabase Dashboard
2. Copy contents of `supabase/schema.sql`
3. Execute the SQL
4. Verify tables are created:
   - profiles
   - conversations
   - messages
   - analytics_events

### Configure Authentication

1. Go to Authentication > Providers
2. Enable Email provider
3. (Optional) Enable Google/GitHub OAuth
4. Configure email templates
5. Set redirect URLs:
   - `https://your-domain.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback` (for development)

---

## 2. Vercel Deployment

### Connect Repository

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Configure project:
   - Framework Preset: Vite
   - Root Directory: `./`
   - Build Command: `cd frontend && npm run build`
   - Output Directory: `frontend/dist`

### Environment Variables

Add these in Vercel Dashboard > Settings > Environment Variables:

```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...

# OpenAI
OPENAI_API_KEY=sk-xxx...

# CORS (your production domain)
ALLOWED_ORIGINS=https://your-domain.vercel.app

# Optional: Rate Limiting
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# Environment
NODE_ENV=production
APP_ENV=production
```

### Deploy

1. Click "Deploy"
2. Wait for build to complete
3. Visit your deployment URL

---

## 3. Post-Deployment Configuration

### Update Supabase URLs

1. Go to Supabase Dashboard > Authentication > URL Configuration
2. Add your Vercel domain:
   - Site URL: `https://vibe-tune-two.vercel.app`
   - Redirect URLs: `https://vibe-tune-two.vercel.app/**`

### Test Deployment

1. Visit your app
2. Sign up with test account
3. Try voice recording
4. Check prosody analysis
5. Verify database updates

---

## 4. Custom Domain (Optional)

### Add Domain in Vercel

1. Go to Project Settings > Domains
2. Add your custom domain
3. Configure DNS records as instructed

### Update Environment Variables

Update `ALLOWED_ORIGINS` with your custom domain:
```env
ALLOWED_ORIGINS=https://your-custom-domain.com,https://vibe-tune-two.vercel.app
```

---

## 5. Monitoring & Logs

### Vercel Logs

- Go to Deployments > Select deployment > Logs
- Monitor API requests and errors

### Supabase Logs

- Go to Supabase Dashboard > Logs
- Monitor database queries and auth events

### Error Tracking (Optional)

Consider integrating:
- Sentry for error tracking
- LogRocket for session replay
- Mixpanel for analytics

---

## 6. Performance Optimization

### Enable Caching

Add to `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

### Enable Compression

Vercel automatically enables gzip/brotli compression.

### CDN Configuration

Vercel Edge Network is enabled by default.

---

## 7. Security Checklist

- [ ] Environment variables set correctly
- [ ] Supabase RLS policies enabled
- [ ] CORS configured for production domain only
- [ ] Rate limiting enabled
- [ ] API keys not exposed in frontend
- [ ] HTTPS enforced
- [ ] Authentication working
- [ ] Database backups enabled

---

## 8. Rollback Procedure

### Instant Rollback

1. Go to Vercel Dashboard > Deployments
2. Find previous working deployment
3. Click "..." > "Promote to Production"

### Manual Rollback

```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or reset to specific commit
git reset --hard <commit-hash>
git push --force origin main
```

---

## 9. Continuous Deployment

### Automatic Deployments

Vercel automatically deploys on:
- Push to `main` branch → Production
- Push to other branches → Preview deployments
- Pull requests → Preview deployments

### Disable Auto-Deploy (if needed)

1. Go to Project Settings > Git
2. Disable "Production Branch"
3. Deploy manually from dashboard

---

## 10. Troubleshooting

### Build Fails

```bash
# Check build locally
cd frontend
npm run build

# Check for TypeScript errors
npm run type-check
```

### API Errors

- Check Vercel Function Logs
- Verify environment variables
- Test API endpoints with Postman

### Database Connection Issues

- Verify Supabase URL and keys
- Check RLS policies
- Test connection in Supabase SQL Editor

### CORS Errors

- Verify `ALLOWED_ORIGINS` includes your domain
- Check browser console for specific error
- Test with curl to isolate issue

---

## 11. Scaling Considerations

### Database

- Monitor Supabase usage
- Upgrade plan if needed
- Add database indexes for performance

### API Rate Limits

- Implement Upstash Redis for rate limiting
- Monitor API usage
- Consider caching responses

### CDN & Edge

- Vercel Edge Network handles this automatically
- Consider Vercel Edge Functions for better performance

---

## Support

For deployment issues:
- Vercel: https://vercel.com/support
- Supabase: https://supabase.com/support
- GitHub Issues: Create an issue in your repository
