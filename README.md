# Salary AI

A personal **AI salary manager** — not an expense tracker. The app learns how a
specific person earns, spends, saves and plans, then turns each salary into a
monthly plan that adapts as real behavior changes.

> Deterministic application code is the source of truth for financial
> calculations. The AI is the reasoning/explanation/interaction layer over
> structured, retrieved facts. — handoff principle

Product specification lives in `docs/product/` (source handoff archive: `SALARY_AI_COMPLETE_HANDOFF  new.zip`).

## Monorepo layout

```
packages/
  domain/          shared types: Money (integer minor units), entities, plan contracts
  finance-engine/  pure deterministic engine — the product's source of truth
  schemas/         zod contracts: AI tool calls, structured recommendations, API payloads
apps/
  api/             Fastify API + static demo client (public/)
infra/
  migrations/      target PostgreSQL schema with RLS-ready ownership
docs/
  product/         handoff index + consolidated master spec
  architecture/    documented default policies and decisions
```

## The core loop

1. Onboarding captures income, commitments, lifestyle, safety and goals
2. `calculateMonthPlan` allocates: **essential obligations protected first**,
   then floors (category/goal minimums), emergency, goals (pace by deadline),
   buffer — the remainder becomes flexible spending split by category weights
3. The assistant explains the plan and answers "can I spend X?" using engine
   results only (`get_safe_to_spend`, `get_goal_projection`, …)
4. Transactions (text/voice parse or manual) compare planned vs actual
5. Month-end insights feed the next plan — the system learns the individual

## Quick start

```bash
npm install
npm test          # 50 deterministic engine tests
npm run dev:api   # http://localhost:3000 — demo client served at /
```

Open the app, hit **“Try the live demo”** for a seeded account, or register a
fresh account (every new account gets the 3-day full-feature trial — server
authoritative; after expiry, gated routes return 402 until subscription).

### API surface (v1)

| Route | Purpose |
|---|---|
| `POST /v1/auth/register` · `login` · `logout` | accounts (scrypt + opaque sessions) |
| `GET/PUT/PATCH /v1/profile*` | Financial DNA, locale/currency settings, export/delete |
| `POST /v1/month-plans/generate` · `/:id/approve` · `GET /current` | plan lifecycle state machine |
| `GET /v1/safe-to-spend` | the daily decision number (documented default) |
| `POST /v1/transactions` · `GET` · `POST /parse` · `PATCH /:id` | capture + rule-based text/voice parser; corrections teach |
| `GET/POST /v1/goals` | goals with engine projections |
| `GET /v1/insights/monthly` · `GET /v1/insights/month-end` | variance, emergency status, recurring forecast, learning preview |
| `POST /v1/month-plans/rollover` | apply learning + generate next month's draft with `adaptations` provenance |
| `POST /v1/imports/csv` | idempotent CSV import with duplicate flagging |
| `GET /v1/billing/status` · `POST /checkout` · `POST /webhook` | trial → subscription entitlements |
| `POST /v1/ai/sessions` · `/:id/messages` | grounded assistant (tool calls + typed recommendation) |

## Non-negotiables honored here

- **LLM is not the calculator** — engine version + inputs hash ship with every number
- **Integer minor units** — no binary floats touch persisted money
- **World-neutral** — no country/currency default; locale is configuration; a
  zero-decimal (JPY) and a 3-decimal (KWD) currency are covered by tests
- **Tenant isolation** — every store access is user-scoped; RLS in the target schema
- **Draft → approve** — consequential actions are explicit state machines
- **Data rights** — export and delete endpoints with an audit trail

## E2E testing with Cypress

Browser E2E tests live in `cypress/e2e/` and run against the dev API + demo
client at `http://localhost:3000`:

```bash
npm run dev:api        # terminal 1
npm run test:e2e       # terminal 2 — headless run (Electron)
npm run cypress:open   # interactive runner
```

- `demo-journey.cy.ts` — the salary loop through the real UI: seed →
  safe-to-spend hero → approved plan with protected money → text quick-add →
  CSV import with duplicate flagging and re-import idempotency → grounded
  assistant → month-end review → rollover to the next month's draft
- `onboarding.cy.ts` — registration → 8-stage wizard → first plan approved;
  a return visit skips the wizard
- `api-contract.cy.ts` — trial entitlements, plan lifecycle totals,
  safe-to-spend shape, auth 401s, health

CI runs everything on every push (`.github/workflows/ci.yml`): a `verify` job
(typecheck + 67 unit tests) and an `e2e` job (Cypress under xvfb against the
dev server, failure diagnostics posted to the tracking issue, screenshots as
artifacts).

## Test coverage

`packages/finance-engine/test/` includes three intentionally different profiles
(PKR salaried with family support, USD variable-income freelancer, JPY
zero-decimal minimal saver), scarcity behavior (income below essentials,
lifestyle-floor unwinding, emergency caps, goal underfunding), the learning
loop (evidence gating, damping, floors), CSV import (idempotency, duplicate
flagging, per-row errors) and the LLM tool loop (scripted fake fetch: tool
round-trips, argument validation, guardrail fallback — no network access).

Total: 70 deterministic tests, no network or clock dependencies.

## Ship it — mobile apps, deployment, real AI

| Step | Where | Time |
|---|---|---|
| Deploy the backend (Docker, one service + disk) | [`infra/DEPLOY.md`](infra/DEPLOY.md) | ~10 min |
| Turn the real AI assistant on (server env only) | [`infra/DEPLOY.md`](infra/DEPLOY.md) §2 | ~5 min |
| Build for Google Play & App Store (EAS cloud builds) | [`infra/DEPLOY.md`](infra/DEPLOY.md) §3–4, [`apps/mobile/README.md`](apps/mobile/README.md) | ~30 min each |
| Store listing copy, data-safety answers, review notes | [`docs/store-listing.md`](docs/store-listing.md) | paste-ready |
| Privacy policy (serve via GitHub Pages) | [`docs/privacy-policy.html`](docs/privacy-policy.html) | done, add your email |

The mobile app (`apps/mobile/`) is an Expo/React Native client of the same API
— the deterministic engine and the AI key stay server-side, so store builds
never carry money math or secrets. Pilot persistence ships as JSON snapshots
to an attached disk (`DATA_DIR`); the Postgres swap is defined in
`infra/migrations/000_init.sql` as the scale-up path.

