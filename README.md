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
| `GET /v1/insights/monthly` | variance, emergency status, recurring forecast |
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

## Test coverage

`packages/finance-engine/test/` includes three intentionally different profiles
(PKR salaried with family support, USD variable-income freelancer, JPY
zero-decimal minimal saver) plus scarcity behavior: income below essentials,
lifestyle-floor unwinding, emergency caps and goal underfunding warnings.
