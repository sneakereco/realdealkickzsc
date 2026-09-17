# Developer onboarding

## Access and prerequisites

Ask an administrator for GitHub access to `sneakereco/realdealkickzsc` and Doppler access to
project `realdealkickzsc`, config `dev`. Install Git, Node.js `24.14.1`, Docker, and the Doppler
CLI. Confirm all four before cloning:

```bash
git --version
node --version
npm --version
docker version
doppler --version
```

## Configuration

Runtime configuration comes from Doppler; `.env.example` is the checked-in inventory. Required
application values are:

| Area          | Variables                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------ |
| Public app    | `NEXT_PUBLIC_SITE_URL`                                                                                       |
| Supabase      | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_DB_URL` |
| Rate limiting | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                                                         |
| Admin session | `ADMIN_SESSION_SECRET`                                                                                       |
| Lightspeed    | `LIGHTSPEED_ACCESS_TOKEN`, `LIGHTSPEED_DOMAIN_PREFIX`, `LIGHTSPEED_WEBHOOK_SECRET`                           |
| Cloudflare    | `CLOUDFLARE_WEB_ANALYTICS_ENABLED`, `CLOUDFLARE_WEB_ANALYTICS_TOKEN`                                         |

`ADMIN_SESSION_SECRET` must decode to exactly 32 bytes. Generate it with
`openssl rand -base64 32`. Keep Cloudflare analytics disabled locally and in staging unless a
specific verification requires it.

## First start

```bash
git clone https://github.com/sneakereco/realdealkickzsc.git
cd realdealkickzsc
npm ci
doppler login
doppler setup
npx supabase start
npm run dev
```

Choose Doppler project `realdealkickzsc` and config `dev`. Open the URL printed by Next.js,
normally <http://localhost:3000>. For later starts, run `npx supabase start` and `npm run dev`.
Run `npx supabase stop` when local database work is complete.

## What to expect

- `/store` and the search overlay read the same published, active, in-stock catalog projection.
- Product and cart surfaces direct purchase intent to the configured Instagram account.
- `/admin/inventory` is read-only; exports and Lightspeed sync controls remain available.
- Lightspeed writes the catalog. Do not add website-side stock or product mutations.
- Cloudflare Web Analytics is deployment-gated and does not run in normal local development.

See [runtime architecture](ARCHITECTURE.md) before changing data ownership and the
[Lightspeed runbook](LIGHTSPEED_RUNBOOK.md) before operating sync.

## Before committing

Run every applicable checked-in test plus the common gates:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:catalog-only
npm run test:admin-readonly
npm run test:lightspeed
npm run test:analytics
npm run test:workflows
npm run test:docs
doppler run -- npm run build
```

## Delivery workflow

1. Branch from current `main`, commit, push, and open a pull request into `main`.
2. Pull-request CI runs formatting, lint, typecheck, and a production build without deployment
   credentials.
3. Merge only after review and green checks. A merge to `main` applies pending migrations,
   deploys Vercel staging, then checks `/api/readyz`.
4. After staging evidence is accepted, tag a commit already in `main` as `vMAJOR.MINOR.PATCH`.
   The production workflow repeats validation, migrations, deployment, and readiness checks.

A green source PR does not prove staging or production deployment. Use the corresponding
GitHub Actions run and deployed `/api/readyz` response as evidence.
