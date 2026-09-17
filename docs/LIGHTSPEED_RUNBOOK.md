# Lightspeed synchronization runbook

## Before operating sync

1. Confirm the target environment and successful `/api/readyz` response.
2. Confirm `LIGHTSPEED_DOMAIN_PREFIX` names the intended store and the access token belongs to
   that store. Never print either secret.
3. Open `/admin/dashboard` and record the latest run status, timestamp, and summary counts.
4. Record the latest webhook state, topic, attempt count, and redacted error. Keep the relevant
   GitHub Actions or Vercel deployment URL with the incident evidence.

## Manual reconciliation

Use **Run Lightspeed sync** on `/admin/dashboard`. The server rejects overlapping runs with HTTP 409. A completed run records `created`, `updated`, `retired`, `skipped`, and `failed` counts:

- `success`: the provider scan and every family completed;
- `partial_failure`: the scan completed but one or more families failed independently;
- `failed`: the provider scan or retirement phase failed.

For a partial failure, inspect the run's per-item evidence, correct the provider data or
credential/configuration cause, then run reconciliation again. For a failed scan, do not edit the
website projection manually: no missing family is retired unless the remote scan completes.

## Webhook delivery and recovery

Configure Lightspeed to send `product.update`, `inventory.update`, and `sale.update` events to
`POST /api/webhooks/lightspeed`. Valid events are durably captured before the 204 response, then
processed after the response. Duplicate IDs are idempotent and older resource versions are
recorded as successful, skipped events.

Event states are `pending`, `processing`, `succeeded`, `retry_wait`, and `needs_attention`.
Processing uses a 10-minute lease. Failures back off exponentially up to one hour; the fifth
failed attempt becomes `needs_attention`.

For `retry_wait` or `needs_attention`:

1. Preserve the event ID, topic, attempt count, last error, and deployment logs.
2. Resolve the root cause: credentials/configuration, provider availability, invalid provider
   data, database migration, or deployment mismatch.
3. Use **Retry** on the dashboard. The tenant-scoped endpoint reuses the same idempotent processor.
4. Confirm the event becomes `succeeded` and its outcome contains a reconciliation summary.
5. Run a manual reconciliation if delivery gaps or several related events are suspected.

## Credential rotation

Rotate one environment at a time in Doppler and redeploy that environment.

- Access token: replace `LIGHTSPEED_ACCESS_TOKEN`, deploy, check readiness, then run a manual
  reconciliation and save its summary.
- Webhook secret: coordinate the new `LIGHTSPEED_WEBHOOK_SECRET` with Lightspeed. During a
  mismatch deliveries return 401. After deployment, confirm a newly signed event reaches
  `succeeded`; retry any captured failures after the cause is fixed.
- Domain/store change: update the tenant mapping and `LIGHTSPEED_DOMAIN_PREFIX` together. A
  mismatch is rejected and must not be bypassed.

Do not copy production secrets into local files, issue comments, logs, or screenshots.

## Launch verification

1. Confirm migrations for sync runs and webhook processing applied in the deployment workflow.
2. Confirm `/api/readyz`, then run one manual reconciliation with zero failed items.
3. Compare representative Lightspeed SKU, price, stock, and inactive products with `/store` and
   `/admin/inventory`; inactive/out-of-stock products must not appear publicly.
4. Deliver one signed webhook and retain its `succeeded` event evidence.
5. Verify catalog purchase actions point to Instagram and Cloudflare behavior follows
   [analytics operations](ANALYTICS.md).
