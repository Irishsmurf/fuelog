# 5. TanStack Query data layer over Firestore

Status: accepted, partly applied (#298)

## Context

Pages called Firestore directly with ad-hoc `useState`/`useEffect`, with no
cache, no cancellation and racing effects. Exports covered only the loaded page.

## Decision

- `src/data/` holds plain, testable Firestore access with no React, for example
  `fetchLogsPage`, and exports that read all matching logs (capped at
  `MAX_EXPORT_LOGS`).
- Pages read through TanStack Query. `src/data/queryClient.ts` sets a 30 s
  `staleTime`, one retry and no refetch on focus. Writes invalidate by query key.
- Every read is parsed by `src/firebase/converters.ts` against the core schemas.
  Invalid documents are reported to Sentry once and still returned.

## Consequences

- History uses it (`useInfiniteQuery`), and exports fetch all matching logs.
- QuickLog, Profile/Vehicles and Dashboard still call Firestore directly and
  are next to migrate.
