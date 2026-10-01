# Lightspeed synchronization runbook

## Before operating sync

1. Confirm the target environment and successful `/api/readyz` response.
2. Confirm `LIGHTSPEED_DOMAIN_PREFIX` names the intended store and the access token belongs to
   that store. Never print either secret.
3. Open `/admin/dashboard` and record the latest run status, timestamp, and summary counts.
4. Record the latest webhook state, topic, attempt count, and redacted error. Keep the relevant
   GitHub Actions or Vercel deployment URL with the incident evidence.

## Manual reconciliation

Use **Sync from Lightspeed** on `/admin/dashboard`. The request returns HTTP 202 with a run ID;
it does not wait for the entire catalog. The server rejects overlapping runs with HTTP 409.
The worker checkpoints every provider page and family. Subsequent scheduled invocations resume
the saved position even if the browser closes. Existing family validation and stock rules apply.
A completed run records `created`, `updated`, `retired`, `skipped`, and `failed` counts:

- `success`: the provider scan and every family completed;
- `partial_failure`: the scan completed but one or more families failed independently;
- `failed`: the provider scan/retirement failed, every family failed, or repeated worker interruptions exhausted recovery;
- `cancelled`: an admin cancelled the run; already saved catalog changes remain.

**Cancel sync** requests cancellation on the server. The current family may finish before the
worker acknowledges it. The tenant stays locked against another sync until that worker exits
or its lease expires. Cancellation during download is checked again before catalog writes.
It does not roll back earlier families. Missing-family retirement only begins after the full
listing and family application phases have completed.

Worker invocations stop taking new work after 180 seconds, abort provider/database work by
240 seconds, and have a Vercel maximum duration of 300 seconds. A six-minute database lease
prevents overlapping workers. A killed worker resumes its last checkpoint after that lease
expires; three consecutive interruptions without saving progress mark the run failed.
Runs from the old non-resumable implementation are marked failed after six minutes without
progress, on the next status read, enqueue, or cron tick. Start a new sync for those legacy runs.

### Deployment requirement

Apply `20260930220000_resumable_lightspeed_sync.sql` before deploying the application.
Configure a separate random `CRON_SECRET` (at least 32 bytes) in each Vercel project's
**Production** environment, and retain it in that environment's Doppler config. Both the
staging and production workflows deploy their respective Vercel projects with `--prod`.
Never print or commit the secret. Without it, hosted manual starts return 503 instead of
creating jobs that cannot continue.

`vercel.json` schedules `/api/cron/lightspeed` every minute. Vercel supplies the secret as a
Bearer authorization header; the route rejects missing/mismatched credentials. See
[Vercel cron security](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).
Verify the job appears under **Project → Settings → Cron Jobs** after deployment and is enabled.
The worker bypasses browser middleware only on this exact path and authenticates in the route.
No extra queue service or package is required. Local Next.js does not run Vercel cron schedules;
invoke this route with a local CRON_SECRET when testing continuation beyond the first batch.

### Finding failures

The dashboard retains the failure reason, per-family errors, timing, cancellation state, and
run ID across reloads. Query `lightspeed_sync_runs` for its saved summary/checkpoint, and
`lightspeed_sync_run_items` for family evidence. In the relevant Vercel project's **Logs**,
filter `/api/admin/lightspeed/reconcile`, `/api/cron/lightspeed`, or `/api/webhooks/lightspeed`.
Application worker errors include `runId`, phase, and current family ID. Platform termination
may only log the request path and `FUNCTION_INVOCATION_TIMEOUT`; correlate its timestamp with
the run's saved progress. Non-JSON platform responses are shown as HTTP errors in the UI.

For a partial failure, inspect the run's per-item evidence, correct the provider data or
credential/configuration cause, then run reconciliation again. For a failed scan, do not edit the
website projection manually: no missing family is retired unless the remote scan completes.

## Webhook delivery and recovery

Live sync is event-driven and separate from manual full-catalog reconciliation. Configure
`product.update`, `inventory.update`, and `sale.update` subscriptions to
`https://YOUR-STAGING-HOST/api/webhooks/lightspeed?token=CALLBACK_SECRET`.
Generate `LIGHTSPEED_WEBHOOK_ROUTE_SECRET` as 32 random bytes encoded as 64 lowercase hex
characters, independently of the Lightspeed application token. Store it in the target
Doppler config and Vercel project's Production environment; deploy before registering subscriptions.
This is a URL credential, not a Lightspeed signing key. Do not publish the complete URL or
include it in application logs. Restrict access to hosting/provider logs that may contain it.
Remove obsolete signing-secret variables when deploying this receiver, retaining them securely
only if needed for rollback to the old receiver.

Live sync reads the tenant ID directly from `public.tenants`, which must contain exactly
one row. Zero or multiple rows reject delivery with `webhook_requires_single_tenant` (503).
No `tenant_lightspeed_settings` row or retailer ID configuration is required. The callback
domain must match `LIGHTSPEED_DOMAIN_PREFIX`. Use the existing private application token
with `webhooks`, `products:read`, `inventory:read`, and `sales:read` permissions.

The receiver authenticates the callback token and validates the domain and single tenant, durably captures a sanitized
event, responds 204, then processes it. Product events fetch only the affected family;
inventory and sale events fetch current stock for affected products. Unknown variants use
the existing family importer. Sale product IDs come from the authenticated sales API.
Stock is never calculated by subtracting sale quantities or trusting the webhook count.
Refunds restore website stock only when the provider inventory is restored.

Duplicates are idempotent and inventory event identities include the outlet. Live work uses
the existing tenant lock and hidden family run scope, without starting manual full-catalog
jobs. Events received during a manual run wait for its lock, then read fresh provider state.
Manual behavior, checkpoints, cancellation and full-scan retirement remain unchanged.

Event states are `pending`, `processing`, `succeeded`, `retry_wait`, and `needs_attention`.
Processing uses a 10-minute event lease and a 240-second work deadline within the 300-second
route limit. Completed events include the targeted run ID in their outcome. Interrupted
family locks recover through the existing six-minute legacy-run recovery. Failures back off;
the fifth attempt becomes `needs_attention`. An occupied tenant waits without consuming an
attempt. Cron retries one event per invocation to bound execution time. Legacy events missing
identity become `needs_attention` rather than blocking the queue. Historical full-catalog
webhook runs are still observed to completion during the transition.

For `retry_wait` or `needs_attention`:

1. Preserve the event ID, topic, attempt count, last error, and deployment logs.
2. Resolve the root cause: credentials/configuration, provider availability, invalid provider
   data, database migration, or deployment mismatch.
3. Use **Retry** on the dashboard. The tenant-scoped endpoint reuses the same idempotent processor.
4. Confirm the event becomes `succeeded` and its `outcome.run_id` identifies a successful run.
5. Run a manual reconciliation if delivery gaps or several related events are suspected.

## Credential rotation

Rotate one environment at a time in Doppler and redeploy that environment.

- Access token: replace `LIGHTSPEED_ACCESS_TOKEN`, deploy, check readiness, then run a manual
  reconciliation and save its summary.
- Callback secret: coordinate `LIGHTSPEED_WEBHOOK_ROUTE_SECRET` with the registered URLs
  and deployment. Mismatches return 401. Confirm an authenticated event reaches `succeeded`
  after rotation; the application access token does not need to change.
- Domain/store change: update `LIGHTSPEED_DOMAIN_PREFIX` and the application token together.
  A callback domain mismatch is rejected and must not be bypassed.

Do not copy production secrets into local files, issue comments, logs, or screenshots.

## Launch verification

1. Confirm migrations for sync runs and webhook processing applied in the deployment workflow.
2. Confirm `/api/readyz`, then run one manual reconciliation with zero failed items.
3. Compare representative Lightspeed SKU, price, stock, and inactive products with `/store` and
   `/admin/inventory`; inactive/out-of-stock products must not appear publicly.
4. Deliver authenticated private-app webhooks and retain `succeeded` event evidence for
   product creation/editing, POS sale, restocking return, and duplicate replay. Confirm that
   refunds without restocking do not increase stock and manual-run overlap defers live writes.
5. Verify catalog purchase actions point to Instagram and Cloudflare behavior follows
   [analytics operations](ANALYTICS.md).
