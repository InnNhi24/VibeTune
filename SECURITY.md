# Security Policy

This repository follows a coordinated disclosure policy. If you discover a security vulnerability, please follow the process below.

1. Report the issue privately to security@your-org.example or open a private issue referencing commit 06a0f4d.
2. Provide steps to reproduce, affected versions, and a minimal repro if possible.
3. Avoid public disclosure until a fix is available.

We aim to respond within 72 hours. For critical vulnerabilities, call our on-call security engineer.

## Best practices
- Do not commit secrets (API keys, service role keys, etc.). Use environment variables and a secrets manager.
- Use least-privilege service role keys for DB writes. Rotate keys periodically.
- Run dependency vulnerability scans (npm audit, Snyk) as part of CI.

## Reporting
Use the contact above or a private channel. Include the repo name, branch, OS, and reproduction steps.

---
Referenced: commit 06a0f4d
