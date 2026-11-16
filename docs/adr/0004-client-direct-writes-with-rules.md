# 4. The browser keeps direct Firestore writes; rules enforce shape

Status: accepted (#259)

## Context

Routing every write through an API would break offline logging, which relies
on Firestore's persistent local cache to queue writes. But the old rules only
checked ownership, and an `apiTokens` update could re-point a token at another
user (account takeover).

## Decision

Keep client writes to `fuelLogs`, `vehicles`, `userProfiles`, `apiTokens`,
`fcmTokens` and station creation, and make the rules the schema gate:
- `userId` can never change on update.
- Fuel-log fields are type-checked on every write.
- `apiTokens` are immutable except for setting `isRevoked: true`. On create they
  need a 64-character hash and scopes from the allowlist.
- Station updates and all server collections (`budgetAlerts`, `usageQuotas`,
  `testNotifications`) are denied to clients.

The rules are tested against the emulator with `@firebase/rules-unit-testing`
in CI (`npm run test:rules`).

## Consequences

- Offline saves work: QuickLog reports success once the write is queued (#299).
- Rules cannot check cross-document invariants (odometer order, derived
  distance). Those belong in server triggers (ADR 0003).
