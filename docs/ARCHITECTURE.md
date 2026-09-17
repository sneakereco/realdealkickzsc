# Runtime architecture

## Ownership

Lightspeed is authoritative for products, variants, SKU identity, price, and stock. Supabase is
the website read model and stores synchronization runs, per-item outcomes, webhook events, auth,
tenant settings, and other website-owned state. The website never writes catalog changes back to
Lightspeed.

The public app is catalog-only. It does not capture payment details or create an order. Cart and
product calls to action hand purchase coordination to Instagram.

## Main flow

```text
Lightspeed API/webhooks
        |
        v
reconciliation service -> Supabase catalog projection -> StorefrontService -> public pages/API
        |
        +-> sync runs and item evidence
        +-> durable webhook event state
```

Manual and webhook-triggered updates use the same `reconcileCatalog` function. Stable
Lightspeed family, product, and SKU identifiers map to existing rows. Missing remote families
are retired only after a complete provider scan; a provider scan failure performs no mutation or
retirement.

## Route and API surface

| Surface                                        | Purpose                                                          |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| `/`, `/store`, `/store/[productId]`, `/brands` | Public catalog browsing                                          |
| `/cart`, `/checkout`                           | Catalog-only purchase guidance; no payment execution             |
| `/admin/dashboard`                             | Sync summary, manual reconciliation, latest webhook status/retry |
| `/admin/inventory`                             | Read-only catalog and export controls                            |
| `/admin/profile`                               | Admin account security                                           |
| `/api/store/**`                                | Published storefront reads and filters                           |
| `/api/admin/products`                          | Admin catalog reads; unsupported mutations return method errors  |
| `/api/admin/lightspeed/reconcile`              | Admin-only latest-run read and manual reconciliation             |
| `/api/admin/lightspeed/events`                 | Admin-only recent webhook evidence                               |
| `/api/admin/lightspeed/events/[id]/retry`      | Tenant-scoped manual event retry                                 |
| `/api/webhooks/lightspeed`                     | Signed Lightspeed event capture                                  |
| `/api/healthz`, `/api/readyz`                  | Process and dependency health                                    |

## Trust boundaries

- Public requests are validated and can read only active, published, in-stock products.
- Admin APIs require an authenticated admin profile and scope data by tenant.
- Webhooks require `application/x-www-form-urlencoded`, a valid `x-signature` HMAC, the expected
  domain prefix, and a matching tenant/retailer mapping.
- The service-role Supabase client is server-only. Browser code uses the publishable key.
- Doppler supplies secrets to local commands and deployment jobs; secrets are never committed.
- Webhook payload storage is sanitized to resource identifiers, version, outlet, and body hash.

## Analytics and deployment

Production can inject one Cloudflare Web Analytics beacon when both Cloudflare variables are
valid. The retired first-party pageview API and admin chart are not part of the runtime. See
[analytics operations](ANALYTICS.md).

Pull requests validate source only. `main` deploys staging; semantic version tags pointing to
`main` deploy production. Both deployment workflows apply Supabase migrations before the Vercel
deployment and verify `/api/readyz` afterward.

## Historical documentation

`docs/legacy/**` and `docs/superpowers/**` preserve previous deployment designs and implementation
plans. They can explain history but do not override this document, onboarding, or the operator
runbook.
