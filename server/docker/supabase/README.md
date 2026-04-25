# Local Supabase + BullMQ

## 1) Create env file for Docker stack

```bash
cp ./docker/supabase/.env.example ./docker/supabase/.env
```

## 2) Start full stack

```bash
docker compose --env-file ./docker/supabase/.env up -d
```

## 3) Stop stack

```bash
docker compose --env-file ./docker/supabase/.env down
```

## 4) Server `.env` local values

Use these values in `server/.env` when running against this local stack:

- `SUPABASE_URL=http://localhost:8000`
- `SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from docker/supabase/.env>`
- `DB_HOST=127.0.0.1`
- `DB_PORT=5432`
- `DB_USER=postgres.dripiq-local`
- `DB_PASSWORD=<POSTGRES_PASSWORD from docker/supabase/.env>`
- `DB_NAME=postgres`
- `REDIS_URL=redis://127.0.0.1:6379`

## Notes

- This compose file includes the full Supabase local stack and Redis for BullMQ.
- `kong.yml` is committed as a file, which avoids the file-vs-directory mount issue.
