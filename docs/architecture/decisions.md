# Architecture decisions — v0.1

Documented defaults for open questions from `08_AI_BUILD_INSTRUCTIONS` ("When unsure:
prefer a configurable policy with a documented default"). Each entry names the rule,
where it lives in code, and how to change it.

## 1. Definition of "safe to spend" (open question #8)

**Default (v1):**

```
flexible remaining  = approved flexible budget − flexible spending this period
reserved            = unpaid essential obligations due later this period
available now       = max(0, flexible remaining − reserved)
daily recommended   = floor(available now / days remaining incl. today)
```

Rationale: protected money is earmarked; until bills physically leave the account,
reserving them against the spendable pool prevents cash-flow collisions.
Conservative by design. Location: `packages/finance-engine/src/safeToSpend.ts`.
Change via: documented policy, engine version bump, tests updated in the same commit.

## 2. Plan allocation order

1. Income (variable sources take a **10% conservative haircut**)
2. Essential obligations — protected, never reduced
3. Floors pass — category minimums + goal minimum contributions
4. Wants pass by priority — emergency top-up (≤30% of income/month) → goals
   (required pace by deadline) → buffer
5. Flexible spending — remainder split by category weights (largest remainder),
   floored categories guaranteed their minimum

Shortfalls unwind in reverse priority and surface as structured warnings;
essential obligations are never silently reduced.
Location: `packages/finance-engine/src/monthPlan.ts` (`DEFAULT_PLAN_POLICY`).

## 3. Money representation

Integer minor units everywhere; floats exist only at the API edge and are
converted once via `moneyFromMajor`. Multi-currency: original amount + currency
preserved per transaction. Location: `packages/domain/src/money.ts`.

## 4. AI architecture

Local grounded provider answers from engine results only; the
OpenAI-compatible adapter (`services/assistant.ts`) is the reviewed seam where
an LLM plugs in with the same typed tool contract, schema-validated outputs and
guardrails. The core app never depends on the LLM (02_UX §11 "AI unavailable:
the core finance app still works").

## 5. Data store (interim)

The prototype runs on an in-memory store behind narrow interfaces
(`apps/api/src/store.ts`) that match `infra/migrations/000_init.sql`. Postgres
(recommended managed provider) + RLS replaces it before any real user data.
Consequence: prototype restarts reset data; the demo seeder rebuilds state.

## 6. Entitlements

3-day full-feature trial from account creation, then paid subscription.
State is server-authoritative (`apps/api/src/billing.ts`); the client clock is
never consulted. Expired accounts keep their data; gated routes return 402.
The "mock" billing provider stands in for app-store/web billing until a
provider integration passes compliance review.

## 7. Time

Timestamps stored in UTC; "today" is computed in the user's timezone at the
service boundary (`apps/api/src/dates.ts`) so payday/month boundaries follow the
user's calendar. The engine takes dates as explicit pure-function arguments.

## 8. Month-end learning policy

`learnCategoryWeights` (finance-engine) proposes gradual weight adjustments:
`new = (1 − damping)·oldShare + damping·observedShare`, rescaled to the old
weight sum. Defaults (`DEFAULT_LEARNING_POLICY`): damping 0.3, minimum weight
0.25× the original mean, evidence threshold 4 categorized transactions in the
period, material-change flag at ≥25% relative movement. Below the evidence
threshold nothing changes. Proposals apply only via the explicit rollover
endpoint (`POST /v1/month-plans/rollover`), are audit-logged, and are recorded
on the generated plan as `adaptations` so the UI can always answer "why did my
plan change?".

## 9. CSV import rules

`apps/api/src/services/imports.ts`: delimiters comma/semicolon/tab
(auto-detected); header optional (detected by date/amount/description tokens,
else columns assume date, amount, merchant); ISO dates preferred, day-first
DD/MM/YYYY otherwise (flagged when ambiguous); amounts strip currency symbols,
parentheses/minus treated as expense; category guessed by merchant keyword then
optional category column. Idempotency: sha256(userId|date|amount|merchant)
stored per transaction — re-imports skip exact rows. Probable duplicates (same
date + amount + ≥60% token-containment merchant match) are flagged, not
counted, and left for user confirmation.
