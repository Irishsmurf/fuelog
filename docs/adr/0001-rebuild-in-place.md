# 1. Rebuild the core in place, not a big-bang rewrite

Status: accepted (2026-11, #259)

## Context

Audits found that the fragility came from a few causes: no single write path
or domain layer, three deployables in one npm package, CI that checked almost
nothing, and god pages with no data layer. Much was worth keeping: the stack
(React 19, Vite, Tailwind v4, Firebase), the design tokens, i18n, the unit
tests, budget alerts, token hashing, the MCP structure, and edge-case fixes
built into QuickLog.

## Decision

Rebuild the foundations (CI, rules, domain package, server-owned data, data
layer) and then rewrite the large pages one at a time on top of them, in the
same repo, shipping after every step. See [`REWRITE_PLAN.md`](../REWRITE_PLAN.md).

## Consequences

- The app keeps shipping; each step has its own exit criteria.
- Old and new patterns coexist for a while (legacy station aggregates next to
  `priceStats`, pages not yet on the data layer).
- Schemas must tolerate legacy documents, so new fields are optional.
