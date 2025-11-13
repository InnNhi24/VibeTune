# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of VibeTune seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Please do NOT:

- Open a public GitHub issue for security vulnerabilities
- Disclose the vulnerability publicly before it has been addressed

### Please DO:

1. **Email us directly** at [your-security-email@example.com] with:
   - A description of the vulnerability
   - Steps to reproduce the issue
   - Potential impact
   - Suggested fix (if any)

2. **Allow time for a fix**: We will acknowledge your email within 48 hours and aim to provide a fix within 90 days.

3. **Coordinate disclosure**: We will work with you to understand and address the issue before any public disclosure.

## Security Best Practices

### Environment Variables

- Never commit `.env` files or any files containing secrets
- Use different API keys for development, staging, and production
- Rotate API keys regularly
- Use environment-specific Supabase projects with different access keys

### API Security

- All API endpoints implement rate limiting (when Upstash Redis is configured)
- CORS is enforced in production (configure `ALLOWED_ORIGINS`)
- Service role keys should only be used on the server side
- Client-side code should only use anon keys with proper RLS policies

### Database Security

- Row-Level Security (RLS) is enabled on all tables
- Users can only access their own data
- Service role key bypasses RLS - use with caution
- Regular backups are maintained

### Authentication

- Supabase Auth handles authentication securely
- Email OTP and OAuth providers are supported
- Session tokens are managed by Supabase client library
- Tokens expire and must be refreshed

### Dependencies

- Run `npm audit` regularly to check for vulnerabilities
- Keep dependencies up to date
- Review security advisories for critical packages
- Use `npm audit fix` to automatically fix issues when safe

### Deployment

- Vercel environment variables are encrypted at rest
- GitHub Actions secrets are encrypted
- Never log sensitive information
- Use HTTPS for all API communications

## Known Security Considerations

1. **Rate Limiting**: Optional Upstash Redis integration for rate limiting. Without it, rate limiting is disabled.

2. **CORS**: In development, CORS is permissive. In production, `ALLOWED_ORIGINS` must be configured.

3. **API Timeouts**: API routes have a 10-second timeout on Vercel Hobby tier. Long-running requests may be aborted.

4. **Client-Side Security**: Sensitive operations should never be performed client-side. Use server-side API routes.

## Security Updates

We will notify users of security updates through:
- GitHub Security Advisories
- Release notes
- Direct communication for critical vulnerabilities

## Compliance

VibeTune follows industry-standard security practices:
- OWASP Top 10 awareness
- Secure development lifecycle
- Regular security audits
- Dependency vulnerability scanning (Trivy in CI/CD)

## Contact

For security concerns, please contact: [your-security-email@example.com]

For general inquiries: [your-general-email@example.com]

---

*Last updated: 2025-11-13*
