# 0010: Membership ledger winner is existence-based and status-agnostic

- Status: proposed
- Date: 2026-10-23
- Supersedes: none (extends 0009)

## Context

The SOURCES ledger crowns a membership claim row "on page" when its
claim matches what the band page displays. `ledgerDisplayValue` in
`web/src/encyclopedia.tsx` resolves a membership row to the person name
only when that person exists in the displayed member list
(`roleByPerson.has(person)`); it never reads `row.status`. Issue #116
asked whether a `disputed` membership claim for a displayed person
should lose the winner badge. Related ledger history: #104 and #113
(winner-vs-rival contract), #115 (NULL attestation).

## Decision

- KEEP the existence-based, status-agnostic winner. The badge means
  "this claim matches what the page displays", and display membership
  comes from the display tables, not from claim status. Making a
  disputed-but-displayed membership render as rival or lead would
  misreport the page.
- Content-policy §2 ("never present disputed as fact") is satisfied
  textually, not by un-crowning: a winner in a dispute-carrying group
  wears "currently shown but disputed" alongside "on page" at full
  weight, never dimmed (ADR-0009 mechanism: `disputedGroup` triggers on
  any row with status `disputed` in the subject+field group, and
  `LedgerRow` appends the qualifier to winners and attestations).
- A disputed membership claim whose person is NOT displayed resolves to
  a blank display and reads as lead (sole claim) or rival, never
  "on page".

## Consequences

- No API, migration, or seed change; the single `LIMIT`-bounded indexed
  lookup budget is unchanged.
- Regression tests in `web/src/encyclopedia.test.tsx` lock the three
  cases: disputed-but-displayed (badged + qualified), disputed and not
  displayed (lead, no badge), confirmed undisputed (bare badge).
