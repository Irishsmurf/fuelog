# 2. Shared `packages/core` for schemas, maths and invariants

Status: accepted (#276, #282)

## Context

Efficiency maths was copied in three places, and every reader cast Firestore
data with `as`, so shape drift was silent.

## Decision

An npm workspace package, `@fuelog/core` (pure TypeScript, ESM, no Firebase
SDK), owns:
- zod document schemas, as timestamp-agnostic factories so the client and
  Admin SDKs each pass their own `Timestamp` validator;
- efficiency, unit and monthly maths;
- odometer rules (`findOdometerViolations`, `deriveDistances`, `previousReading`);
- `localizeStation`.

The web app imports `@fuelog/core`. Server code in `api/` and `src/mcp/`
imports it by **relative path** (`../packages/core/src/index.js`): Vercel
compiles `api/` itself and is known to follow relative `.ts` imports, but not
workspace packages. `functions/` is a separate npm project and does not import
core yet.

## Consequences

- One copy of the maths, with property tests on the odometer rules.
- The relative imports are a stopgap until server code moves to a single
  backend ([ADR 0007](0007-proposed-single-backend-maplibre-no-flags.md)).
- Firebase Deploy also runs on changes to `packages/core/**`.
