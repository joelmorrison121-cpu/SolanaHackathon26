# Backend Security

## Enabled protections

- JSON requests are limited to 16 KiB by default and require `Content-Type: application/json`.
- Bill fields are type-checked, bounded, normalized, and stored as integer minor units.
- Payer names and creator IDs have control characters removed and length limits.
- Wallets are limited to base58 characters without enforcing an exact address length.
- API requests are rate-limited in memory by client address, method, and route.
- State-changing browser requests are checked against the configured CORS origins and cross-site fetch metadata. The API does not use cookie authentication, so there is no ambient session for a CSRF attack to reuse.
- API responses include security headers, including CSP, `nosniff`, frame denial, and a restrictive permissions policy.
- Production can require HTTPS with `ENFORCE_HTTPS=true`. Set `TRUST_PROXY=true` only when a trusted TLS-terminating proxy sets `X-Forwarded-Proto`.
- No HTML is rendered by this API. The frontend must render user-controlled names as text, never as HTML.
- Responses use `Cache-Control: no-store` because payment links act as bearer credentials.
- Payer records are isolated by a cryptographically random link token; guessed or modified tokens return `404`.
- Client-supplied status, amount, and other unknown fields are ignored by the bill model.

## Not currently applicable

- There are no passwords, file-upload routes, SQL queries, or API keys in this backend.
- There are no authenticated admin or creator routes yet. Bill creation is therefore not an authenticated operation; add Google/Privy session verification before production use.
- Row-level security (RLS) is not applicable until a database and authenticated user identity exist. When PostgreSQL is added, enable RLS on bills, payers, and settlement attempts and scope policies to the authenticated creator/payer identity.
- Data is currently in memory. If a database is added, use parameterized queries only.
- If password authentication is added later, use a password hashing algorithm such as Argon2id or bcrypt with a work factor chosen for the deployment. Never store plaintext passwords.
- If file uploads are added later, use an allowlist of types, size limits, random storage names, malware scanning, and storage outside the executable/static tree.

## Deployment checklist

1. Copy `.env.example` to `.env` locally; keep `.env` out of Git.
2. Set `ENFORCE_HTTPS=true`, `TRUST_PROXY=true` only behind the known TLS proxy, and an exact production `CORS_ORIGINS` list.
3. Rotate every settlement or provider secret through the provider's dashboard and deployment secret store. Never commit secrets or log them.
4. Run `npm audit` after adding or upgrading dependencies. This project currently has no runtime dependencies.
5. Keep rate limits and request size limits enabled in production.
6. Use a persistent, access-controlled log store before relying on settlement-attempt logs for audit history.
