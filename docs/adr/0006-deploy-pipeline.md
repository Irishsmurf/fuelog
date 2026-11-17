# 6. Deploy pipeline: smoke the production domain, roll back, Functions from CI

Status: accepted (#269, #284, #285, #286, #295)

## Context

The old smoke test only checked for HTTP 200, and production-only bundling
failures reached users. Functions were deployed by hand.

## Decision

- **Main CI** (pull requests and main): lint, `tsc -b`, unit tests, rules tests
  on the emulator, Functions build, tests and audit, a build, and a Playwright
  `@smoke` run against a production build in the official Playwright container.
- **Vercel** (push to main): build, deploy and `vercel promote`, then run the
  smoke tests against the **public production domain**. The domain is resolved
  through the Vercel API, because the `*.vercel.app` URL sits behind Deployment
  Protection. A preflight marks the run inconclusive if the domain redirects to
  a login wall. On a real smoke failure, `vercel rollback` returns to the
  previous production deployment, the only rollback the Hobby plan allows.
- **Firebase Deploy** (push to main touching `firebase/`, `functions/`,
  `packages/core/` or the workflow):
  1. run the Functions tests;
  2. write `functions/.env` with `DEV_NOTIFICATION_UIDS` from the repo variable
     (default `none`);
  3. set 7-day Artifact Registry cleanup policies in `us-central1` and
     `europe-west1`;
  4. run `firebase deploy --only firestore,storage,functions` without `--force`,
     so a deploy that would delete a function fails loudly.

## Consequences

- A bad web deploy is reverted automatically; a bad Functions deploy is not.
- Firebase deploys authenticate with Workload Identity Federation (OIDC) once the
  `GCP_WORKLOAD_IDENTITY_PROVIDER` and `GCP_SERVICE_ACCOUNT` repo variables are set,
  falling back to the legacy `FIREBASE_TOKEN` secret until then
  (setup: `docs/playbooks/DEPLOYMENT.md`).
