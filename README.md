# Realdealkickzsc

Realdealkickzsc is a catalog-only sneaker storefront. Customers browse current inventory and
contact the store on Instagram to purchase. The website does not take payments or create
orders.

Lightspeed is the inventory source of truth. Supabase stores the read model used by the
storefront plus synchronization evidence. Website admins can view and export inventory, run a
reconciliation, and retry failed webhook events; they cannot edit catalog stock locally.

## Start here

1. Follow [developer onboarding](docs/DEVELOPER_ONBOARDING.md) to configure and run the app.
2. Read [runtime architecture](docs/ARCHITECTURE.md) for routes, ownership, and trust boundaries.
3. Use the [Lightspeed operator runbook](docs/LIGHTSPEED_RUNBOOK.md) for sync and recovery.
4. Use [analytics operations](docs/ANALYTICS.md) for Cloudflare deployment verification.

Historical material is retained under `docs/legacy` and `docs/superpowers`; it is not an
operator guide for the current application.

## Stack

- Next.js 16 and React 19
- Supabase Postgres and Auth
- Lightspeed Retail API and signed webhooks
- Upstash Redis rate limiting
- Cloudflare Web Analytics in production
- Vercel deployments through GitHub Actions and Doppler

## Quick verification

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:catalog-only
npm run test:admin-readonly
npm run test:lightspeed
npm run test:analytics
npm run test:workflows
npm run test:docs
npm run build
```
