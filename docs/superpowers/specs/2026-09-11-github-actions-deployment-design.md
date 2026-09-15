# GitHub Actions Deployment Design

**Date:** 2026-09-11

**Status:** Implemented locally; external platform activation pending

## Objective

Replace the current branch-specific deployment pipeline with one release path:

```text
feature branch
    -> pull request checks
main
    -> automatic staging deployment
vMAJOR.MINOR.PATCH tag on a main commit
    -> production deployment
```

Doppler is the source of truth for application and deployment secrets. Staging and production continue to use separate Vercel and Supabase projects.

## Scope

This change will:

- add pull-request CI for changes targeting `main`;
- deploy `main` automatically to staging;
- deploy an immutable semantic-version tag to production;
- separate validation, migration, deployment, and verification into jobs;
- stop automatic staging seeding;
- replace ineffective health checks with a hard-failing readiness check;
- use Doppler to manage GitHub Actions and Vercel configuration; and
- document the release and platform-configuration procedures.

This change will not deploy production, delete the `staging` branch, modify application behavior, introduce reusable workflow abstractions, or add speculative caches.

## Release Architecture

### Pull requests

Feature branches open pull requests into `main`. Pull-request CI runs formatting, lint, typechecking, and a production build. Deployment credentials must not be exposed to pull-request code.

The pull-request build uses explicit non-secret placeholder values that satisfy configuration validation. It must not connect to live infrastructure. The staging workflow performs the credentialed build after merge.

### Staging

A push to `main` starts the staging workflow. This workflow targets the staging GitHub environment, the staging Doppler deployment config, the staging Supabase project, and the staging Vercel project.

The staging Vercel project is a separate project whose production environment serves the staging domain. Therefore, using Vercel's production target for this project is intentional.

### Production

A pushed tag matching `v*.*.*` starts the production workflow. The workflow deploys the tagged commit, not a moving checkout of `main`. A release-validation job must reject a tag whose commit is not reachable from `main`.

Creating the tag is the manual release action. Supported operator paths are:

```powershell
gh release create v1.2.3 --target main --generate-notes
```

or GitHub's **Releases -> Draft a new release** interface with `main` selected as the target.

## Workflow Files

### `.github/workflows/ci.yml`

Trigger: `pull_request` targeting `main`.

One `validate` job performs:

1. checkout and Node setup with the npm download cache;
2. `npm ci`;
3. `npm run format:check` and `npm run lint` as separate steps;
4. `npm run typecheck`; and
5. a non-secret `next build` with explicit placeholder configuration.

No deployment environment or deployment secret is available to this workflow.

### `.github/workflows/staging.yml`

Trigger: push to `main`.

Jobs:

1. `validate` runs the repository quality checks.
2. `migrate` applies pending migrations to staging after validation.
3. `deploy` builds and deploys the staging Vercel project after migration succeeds.
4. `verify` checks the deployed staging `/api/readyz` endpoint after deployment succeeds.

### `.github/workflows/production.yml`

Trigger: pushed tag matching `v*.*.*`.

Jobs:

1. `validate-release` verifies the tag format and confirms that the tagged commit is in `main` history, then runs the repository quality checks.
2. `migrate` applies pending migrations to production after release validation.
3. `deploy` builds and deploys the production Vercel project after migration succeeds.
4. `verify` checks the immutable deployment URL's `/api/readyz` endpoint after deployment succeeds.

The production workflow will not also use `workflow_dispatch`; this avoids two release mechanisms for the same operation. An operator can create a release through GitHub or the GitHub CLI.

## Job and Step Boundaries

GitHub Actions reruns jobs, not individual steps. Steps remain separate where they improve error location, while jobs define meaningful retry and secret boundaries.

- `validate` owns dependency installation and code-quality diagnostics.
- `migrate` is the only job allowed to mutate a remote database.
- `deploy` is the only job allowed to publish a Vercel deployment.
- `verify` is credential-minimal and decides whether the deployment is healthy.

Jobs run on isolated runners, so checkout and tool setup are repeated where required. Build artifacts will not initially be transferred between jobs because that adds retention, integrity, and secret-handling concerns without a measured need.

## Database Migrations

Migration execution is separated from application deployment. `supabase db push` uses Supabase's migration-history table and applies only pending migrations. When no migration is pending, the job performs no database mutation.

The workflows will not implement custom Git-diff migration detection. A path-only test can miss an unapplied migration after a previously failed release. Supabase's remote migration state is the authoritative check.

The staging seed command will be removed. Seeding must be an explicit operator action for a disposable environment, never an automatic part of every application deployment. Production is never seeded.

Only one workflow per environment may migrate or deploy at a time. Concurrency queues later deployments instead of cancelling a workflow that may be changing the database.

## Doppler Boundaries

The Doppler Developer plan does not provide OIDC service-account identities. GitHub therefore needs one static, read-only Doppler service token per deployment environment.

Use four environment-specific configs:

- `stg`: staging application runtime and build variables;
- `prd`: production application runtime and build variables;
- `stg_ci`: staging deployment credentials; and
- `prd_ci`: production deployment credentials.

The `_ci` configs prevent deployment credentials such as `VERCEL_TOKEN` and Supabase migration credentials from being synced into the application runtime.

`SUPABASE_DB_URL` is currently validated by the application but has no runtime consumer. Remove it from `src/config/env.ts`; the real database URL then exists only in the appropriate `_ci` config and is not duplicated into Vercel.

The GitHub `staging` environment stores one `DOPPLER_TOKEN` scoped to `stg_ci`. The GitHub `production` environment stores one `DOPPLER_TOKEN` scoped to `prd_ci`. No individual application, Vercel, Redis, or Supabase credential is duplicated into GitHub.

The workflows fetch Doppler secrets only inside the job that needs them. Secret values must not be written to files, step outputs, logs, or build artifacts.

## Vercel Configuration

Create two Doppler Vercel syncs:

1. Doppler `stg` -> staging Vercel project -> Production environment;
2. Doppler `prd` -> production Vercel project -> Production environment.

Both syncs use Vercel Sensitive variables. Doppler remains the editing source of truth; Vercel receives managed copies because its build and serverless runtimes require environment variables.

The workflows build inside the credentialed GitHub Actions deploy job after Doppler injects the build variables. They run `vercel build --prod`, then upload `.vercel/output` with `vercel deploy --prebuilt --prod`; Vercel must not start a second remote build. The CLI is invoked as the exact ephemeral version `npx --yes vercel@59.16.0`, avoiding an application dependency solely for deployment tooling.

Disconnect Vercel's Git auto-deployment from both projects before enabling the Actions workflows. Otherwise, a push to `main` can produce duplicate staging deployments or bypass the tag gate on the production project.

A Doppler secret change affects the next Vercel deployment. Secret changes do not create an alternate production release path.

## GitHub Configuration

### Environments

In **Repository -> Settings -> Environments**:

1. Create or open `staging`, then add environment secret `DOPPLER_TOKEN` using a read-only `stg_ci` service token.
2. Restrict staging deployment sources to `main` where the repository plan supports deployment branch policies.
3. Create or open `production`, then add environment secret `DOPPLER_TOKEN` using a read-only `prd_ci` service token.
4. Restrict production deployment sources to protected tags or `v*.*.*` where supported.
5. Add required production reviewers when supported by the repository's visibility and GitHub plan.

### Main branch ruleset

In **Repository -> Settings -> Rules -> Rulesets**, create an active branch ruleset targeting `main`:

- require a pull request before merging;
- require the pull-request CI status check;
- require the branch to be current before merging;
- block force pushes; and
- restrict deletion.

### Release tag ruleset

Where supported, create an active tag ruleset targeting `v*` and restrict tag creation, update, and deletion to release owners. The production workflow's main-history guard remains required even when a tag ruleset exists.

### Actions permissions

Set default workflow permissions to read-only. Each workflow declares `contents: read`. No workflow needs permission to push commits or tags.

## Reliability and Failure Handling

- Set explicit job timeouts.
- Use environment-specific concurrency with cancellation disabled.
- Pin third-party actions and the Vercel CLI to reviewed versions.
- Capture the Vercel deployment URL as a job output without printing secrets.
- Retry `/api/readyz` for a bounded interval, then fail instead of suppressing the error.
- Preserve the tagged SHA for every rerun; GitHub reruns use the original event SHA.

If migration succeeds and deployment fails, rerunning the failed deployment is safe because the migration job is already successful. If a full workflow rerun repeats migration, Supabase skips migrations already recorded as applied.

## Caching

Keep `actions/setup-node` with `cache: npm`, which caches downloaded npm packages based on the lockfile. Do not cache `node_modules`.

Do not initially add `.next`, `.vercel`, Docker-layer, or cross-job artifact caches. Add one only after workflow timings identify a meaningful bottleneck and the cache key can include every correctness-relevant input.

## Existing Problems Corrected

The implementation will correct these current defects:

- move deployment variables out of the invalid `services` nesting and scope them to the jobs that need them;
- trigger staging from `main`, stop automatic staging seeding, and remove the unused runtime `SUPABASE_DB_URL` requirement;
- replace the suppressed liveness-only `/api/healthz` deployment check with a hard-failing `/api/readyz` dependency check;
- pin the Vercel CLI and third-party actions instead of installing floating releases; and
- validate production tags against `main` and split validation, migration, deployment, and verification into job retry boundaries.

## Verification

Before merging the workflow change:

1. validate all workflow YAML with `actionlint`;
2. run formatting, lint, and typechecking locally;
3. run the production build with a development-only Doppler config;
4. inspect the diff for secret values and unsafe logging; and
5. verify job dependencies, permissions, timeouts, concurrency, and environment names.

After merging:

1. confirm pull-request CI is a required `main` check;
2. observe one successful automatic staging migration/deployment/readiness run;
3. confirm Vercel did not create a duplicate Git deployment;
4. confirm the deployed commit matches the `main` SHA; and
5. create a production tag only during a separately approved release window.

Production success requires live deployment evidence. Local validation and a successful staging deployment are not proof that production has been released.

## Rollout and Recovery

Implement and validate the new workflows while leaving the `staging` branch intact. After a successful `main` staging deployment, remove any branch protection or operational documentation that still treats `staging` as a release branch. Delete the remote `staging` branch only through a separate, explicitly confirmed cleanup action.

If staging deployment fails, no production tag is created. If production verification fails after deployment, use the Vercel deployment history to restore the previously verified production deployment, then diagnose the failed tagged release without moving or rewriting the tag.
