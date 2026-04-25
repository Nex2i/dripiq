# Multi-Customer SSO Onboarding (Supabase + DripIQ)

This guide explains how to onboard each enterprise customer with their own SAML SSO configuration while routing users to the correct DripIQ tenant.

## What Was Configured Now

Using the Supabase MCP plugin against project `wflzjydlmlvvluzjjohw` (`dripiq`), we mapped `dripiq.ai` to the existing `dripiq` tenant:

- Tenant: `dripiq_app.tenants.id = f47qpva1z342424trqxiekca` (`name = dripiq`)
- Domain mapping: `dripiq_app.tenant_domain_mappings.domain = dripiq.ai`

SQL used:

```sql
insert into dripiq_app.tenant_domain_mappings (id, tenant_id, domain, is_verified, created_at, updated_at)
values ('map_dripiq_ai', 'f47qpva1z342424trqxiekca', 'dripiq.ai', true, now(), now())
on conflict (domain) do update
set tenant_id = excluded.tenant_id,
    is_verified = excluded.is_verified,
    updated_at = now();
```

Then, using Supabase CLI, we created the SAML provider and verified it:

```bash
supabase sso add --type saml --project-ref wflzjydlmlvvluzjjohw \
  --metadata-url 'https://trial-8824406.okta.com/app/exk12bo3bwlp0r91S698/sso/saml/metadata' \
  --domains dripiq.ai
```

Provider created:

- `sso_provider_id`: `98c1646f-319e-4e19-9e86-b7574a315b17`
- `entity_id`: `http://www.okta.com/exk12bo3bwlp0r91S698`
- domain assigned: `dripiq.ai`

Verification commands:

```bash
supabase sso list --project-ref wflzjydlmlvvluzjjohw -o json
supabase sso show 98c1646f-319e-4e19-9e86-b7574a315b17 --project-ref wflzjydlmlvvluzjjohw -o json
supabase sso info --project-ref wflzjydlmlvvluzjjohw -o json
```

## Architecture (Per Customer)

For each customer, configure two layers:

1. Supabase Auth SAML provider for that customer IdP.
2. DripIQ tenant-domain mapping (`tenant_domain_mappings`) so SSO bootstrap can auto-provision into the right tenant.

## Onboarding Checklist Per Customer

### 1) Create or identify the customer tenant

Ensure one `dripiq_app.tenants` row exists for the customer.

### 2) Add domain -> tenant mapping

Insert one row in `dripiq_app.tenant_domain_mappings` per customer domain.

Template:

```sql
insert into dripiq_app.tenant_domain_mappings (id, tenant_id, domain, is_verified, created_at, updated_at)
values ('map_<customer_domain>', '<tenant_id>', '<customer_domain>', true, now(), now())
on conflict (domain) do update
set tenant_id = excluded.tenant_id,
    is_verified = excluded.is_verified,
    updated_at = now();
```

Example:

- domain: `customer1.com`
- tenant_id: `<their tenant id>`

### 3) Add the customer SAML provider in Supabase

Use the customer metadata URL (or metadata file) to create a SAML connection in Supabase Auth.

For the Okta example metadata URL:

- `https://trial-8824406.okta.com/app/exk12bo3bwlp0r91S698/sso/saml/metadata`

#### Option A: Supabase CLI

```bash
supabase sso add --type saml --project-ref wflzjydlmlvvluzjjohw \
  --metadata-url 'https://trial-8824406.okta.com/app/exk12bo3bwlp0r91S698/sso/saml/metadata' \
  --domains dripiq.ai
```

Use these commands to inspect or update providers:

```bash
supabase sso list --project-ref wflzjydlmlvvluzjjohw
supabase sso show <provider-id> --project-ref wflzjydlmlvvluzjjohw
supabase sso update <provider-id> --project-ref wflzjydlmlvvluzjjohw --metadata-url '<new-url>'
```

#### Option B: Supabase Dashboard

1. Open project Auth providers.
2. Enable SAML.
3. Add provider metadata URL or upload metadata XML.
4. Assign customer domain(s), for example `dripiq.ai`.
5. Save and test.

### 4) Ensure your app flow matches login mode

Current app supports callback bootstrap flow and tenant provisioning.

The login path now uses domain-based discovery for multi-customer routing:

- `signInWithSSO({ domain: 'customer-domain.com' })`

If using pure IdP-initiated tiles, domain assignment is optional for routing from IdP, but you still need `tenant_domain_mappings` for app provisioning.

### 5) Verify end-to-end

1. Login via customer IdP.
2. Confirm `/auth/sso/bootstrap` returns:
   - `provisioned` or `already_provisioned` when domain is mapped.
   - `requires_registration` when domain is not mapped.
3. Confirm `users` + `user_tenants` rows exist and tenant is correct.

## Multi-Customer Operating Model

- One SAML provider per customer IdP configuration.
- One or more domains per provider as needed.
- One tenant per customer in `dripiq_app.tenants`.
- One domain mapping per customer domain in `dripiq_app.tenant_domain_mappings`.

This scales cleanly to 10+ customers as long as each customer domain is uniquely mapped.

