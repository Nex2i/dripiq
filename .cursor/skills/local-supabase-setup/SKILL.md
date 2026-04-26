---
name: local-supabase-setup
description: Run local Supabase setup and troubleshooting for DripIQ. Use when configuring local Supabase, local Auth, local password login, anon key mismatches, Docker Compose Supabase services, or local /auth/v1 failures.
---

# Local Supabase Setup

Use this runbook for DripIQ's local Supabase stack.

## Rules

- Local auth is password auth only. Do not enable SAML or SSO locally.
- Public email domains such as `gmail.com`, `yahoo.com`, `outlook.com`, `hotmail.com`, and `icloud.com` must remain password-account domains.
- Do not add `GOTRUE_SAML_ENABLED`, `GOTRUE_SAML_PRIVATE_KEY`, `ENABLE_SAML`, or `SAML_PRIVATE_KEY` to local setup.
- Do not create local SAML providers. If one exists, delete it.
- `server/docker/supabase/.env` and `client/.env` are local-only; do not commit local secret values.

## Start Local Supabase

```bash
cd server
docker compose --env-file ./docker/supabase/.env up -d
```

Use these local values:

```dotenv
VITE_SUPABASE_URL=http://localhost:8000
SUPABASE_URL=http://localhost:8000
```

## Fix Anon Key Mismatch

Kong returns `401` with `WWW-Authenticate: Key` when the client anon key does not match the key loaded into Kong.

1. Compare `client/.env` `VITE_SUPABASE_ANON_KEY` with `server/docker/supabase/.env` `ANON_KEY`.
2. Align `client/.env` to the local stack anon key.
3. Recreate only the local auth gateway containers:

```bash
cd server
env -u ANON_KEY -u SERVICE_ROLE_KEY docker compose --env-file ./docker/supabase/.env up -d --force-recreate kong auth
```

4. Restart the client Vite dev server so env changes are loaded.

## Verify Local Auth

Settings should show SAML disabled:

```bash
curl -sS http://localhost:8000/auth/v1/settings \
  -H "apikey: <local anon key>"
```

Expected: `"saml_enabled": false`.

Password login uses Supabase Auth password endpoints through `supabase-js`. Do not route local users through `/auth/v1/sso`.

## Remove Accidental Local SSO Providers

List local SSO providers:

```bash
curl -sS http://localhost:8000/auth/v1/admin/sso/providers \
  -H "apikey: <local service role key>" \
  -H "Authorization: Bearer <local service role key>"
```

Delete any provider that appears:

```bash
curl -sS -X DELETE http://localhost:8000/auth/v1/admin/sso/providers/<provider-id> \
  -H "apikey: <local service role key>" \
  -H "Authorization: Bearer <local service role key>"
```

## Verify No Local SSO

This should not return an IdP URL:

```bash
curl -i -sS http://localhost:8000/auth/v1/sso \
  -H "apikey: <local anon key>" \
  -H "Authorization: Bearer <local anon key>" \
  -H "Content-Type: application/json" \
  --data '{"domain":"gmail.com","redirect_to":"http://localhost:3000/auth/sso/callback","skip_http_redirect":true}'
```

Expected: a non-200 SSO discovery error, not an SSO redirect URL.
