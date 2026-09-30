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

Configure Lightspeed to send `product.update`, `inventory.update`, and `sale.update` events to
`POST /api/webhooks/lightspeed`. Valid events are durably captured before the 204 response, then
processed after the response. Duplicate IDs are idempotent and older resource versions are
recorded as successful, skipped events.

Event states are `pending`, `processing`, `succeeded`, `retry_wait`, and `needs_attention`.
Event enqueue uses a 10-minute claim lease. Once enqueued, `outcome.run_id` points to the same
durable worker used by manual sync. Cron checks that run before marking the event successful.
Cancelled, failed, or partially failed runs become `needs_attention` instead of automatically
undoing an admin cancellation. Enqueue failures back off up to one hour; the fifth failed
attempt becomes `needs_attention`. An occupied tenant waits without consuming an attempt.

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
