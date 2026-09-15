# Vercel Prebuilt Deployment Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Vercel artifacts inside GitHub Actions with Doppler-injected secrets and deploy those artifacts without a second remote build.

**Architecture:** Make `npm run build` platform-neutral, then run `vercel build --prod` in each credentialed deploy job before `vercel deploy --prebuilt --prod`. Local developers wrap the portable build with `doppler run --`.

**Tech Stack:** GitHub Actions, Doppler secrets-fetch action, Vercel CLI 59.16.0, Next.js 16, Node.js test runner.

**Spec:** `docs/superpowers/specs/2026-09-11-github-actions-deployment-design.md`

## Global Constraints

- Keep Vercel CLI pinned to `59.16.0`.
- Build only in the credentialed deploy job after migrations pass.
- Keep staging and production deployment flows structurally identical.
- Do not write Doppler secrets to files, logs, outputs, or artifacts outside Vercel's build output.

---

### Task 1: Build and deploy prebuilt Vercel artifacts

**Files:**

- Modify: `tests/workflows/staging-workflow.test.mjs`
- Modify: `tests/workflows/production-workflow.test.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/staging.yml`
- Modify: `.github/workflows/production.yml`
- Modify: `docs/DEVELOPER_ONBOARDING.md`
- Modify: `docs/superpowers/specs/2026-09-11-github-actions-deployment-design.md`

**Interfaces:**

- Consumes: Doppler-injected environment variables and `.vercel` project metadata from `vercel pull`.
- Produces: `.vercel/output` from `vercel build` and an immutable deployment URL from `vercel deploy --prebuilt`.

- [ ] **Step 1: Write the failing workflow contract tests**

  Require both deployment workflows to run pinned `vercel build --prod` before pinned `vercel deploy --prebuilt --prod`. Require `package.json` to expose `next build` without a Doppler wrapper.

- [ ] **Step 2: Run the workflow tests and verify RED**

  Run: `npm run test:workflows`

  Expected: staging and production tests fail because the workflows upload source for a remote build and the package build script invokes `doppler`.

- [ ] **Step 3: Implement the minimum repair**

  Set `build` to `next build`, use it in pull-request CI, add a Vercel build step to staging and production, and deploy with `--prebuilt`. Update local onboarding to run `doppler run -- npm run build` and revise the existing deployment design.

- [ ] **Step 4: Run the workflow tests and verify GREEN**

  Run: `npm run test:workflows`

  Expected: all workflow contract tests pass.

- [ ] **Step 5: Verify the branch**

  Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:workflows`, and `doppler run -- npm run build`. Run `git diff --check` and inspect the final diff for secrets.

- [ ] **Step 6: Commit**

  ```bash
  git add package.json .github/workflows tests/workflows docs
  git commit -m "fix: deploy prebuilt Vercel artifacts"
  ```
