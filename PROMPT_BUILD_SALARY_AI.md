# THE PROMPT — Salary AI: Install Skills, Then Build a Humanized App Structure

Copy everything between the `---BEGIN---` and `---END---` markers into any coding agent
(Arena, Claude Code, Cursor, Codex, Windsurf, Gemini CLI) with this repo open.

---BEGIN---

## ROLE

You are a **senior product designer + staff front-end engineer** building **Salary AI** —
a mobile-first personal AI salary manager. You are not generating a demo. You are
establishing the app structure, design language and screen system that a real team
will ship on.

Read these first and treat them as source of truth, above your own assumptions:
- `SALARY_AI_COMPLETE_HANDOFF  new.zip` → especially `02_UX_UI_EXPERIENCE.docx`,
  `09_COMPLETE_MASTER_SPEC.md`, `00_MASTER_HANDOFF.docx`, `04_TECHNICAL_ARCHITECTURE_CODEBASE.docx`
- `AGENTS.md` in this repo

---

## STEP 1 — INSTALL THESE REPOS / SKILLS (do this before writing any UI)

**A. Design intelligence skill (already vendored at `.claude/skills/ui-ux-pro-max/` — verify it runs):**

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "payroll salary fintech dashboard" --design-system
```

If missing, install it:
```bash
npm install -g uipro-cli && uipro init --ai claude
# or: npx skills add nextlevelbuilder/ui-ux-pro-max-skill --skill ui-ux-pro-max
# or: git clone --depth 1 https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git \
#     && cp -r ui-ux-pro-max-skill/.claude/skills/ui-ux-pro-max .claude/skills/
```
Source: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill

**B. Implementation libraries — install into `apps/web`:**

| Repo | Install | Used for |
|---|---|---|
| https://github.com/shadcn-ui/ui | `npx shadcn@latest init` | Accessible Radix+Tailwind base components |
| https://github.com/tailwindlabs/tailwindcss | via Next.js setup | Token-driven styling |
| https://github.com/lucide-icons/lucide | `npm i lucide-react` | Consistent SVG icons (**never emoji as icons**) |
| https://github.com/tremorlabs/tremor | `npm i @tremor/react` | Financial charts that respect tokens |
| https://github.com/framer/motion | `npm i motion` | Purposeful motion + `useReducedMotion` |
| https://github.com/pacocoursey/next-themes | `npm i next-themes` | Dark mode designed in from day one |
| https://github.com/colinhacks/zod | `npm i zod` | Schema validation for AI tool args + forms |
| https://github.com/TanStack/query | `npm i @tanstack/react-query` | Server state, optimistic edits, stale timestamps |

**C. Reference libraries to study, not blindly copy** — pull one or two ideas each and say
in `docs/design/INSPIRATION.md` exactly what you took and why:
- https://github.com/magicuidesign/magicui — restrained reveal/number animations
- https://github.com/imskyleen/animate-ui — state-transition choreography
- https://github.com/bradtraversy/design-resources-for-developers — design-system index
- https://github.com/goabstract/Awesome-Design-Tools — tooling
- https://github.com/dalisoft/awesome-ui-libraries — component-library survey

**Rule:** query the skill **before** every visual decision and record the query + result
in `docs/design/DESIGN_DECISIONS.md`. Useful calls:
```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "finance app trust palette" --domain color
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "dashboard font pairing tabular numerals" --domain typography
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "empty state no data yet" --domain ux
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "spending trend over time" --domain chart
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "form validation error near field" --stack nextjs
```

---

## STEP 2 — STUDY REAL APPS, NOT AI TEMPLATES

Before designing, write `docs/design/COMPETITIVE_TEARDOWN.md` analysing the **interaction
and emotional patterns** (not the colors) of real shipped products:

**Monarch Money · Copilot Money · Origin · Rocket Money (Rowan) · Revolut · Monzo ·
Wise · Nubank · Cleo · YNAB · Emma · MyHisaab · MunshiJi**

For each, answer: what is the single hero number on the home screen? How do they deliver
bad news without shaming? What does their month-end moment feel like? What makes them feel
like a *person* rather than a spreadsheet?

Then extract a **Patterns We Adopt / Patterns We Reject** table. Reject: leaderboard
gamification, confetti on saving money, guilt-red overspend banners, dashboards of
twelve tiny widgets, generic purple-gradient "AI" chrome, chatbot bubble bolted onto a corner.

---

## STEP 3 — THE HUMANIZED DESIGN MANDATE (this is the heart of the request)

The app must not read as a plain AI-generated app. It must feel like **something that knows
you and is on your side**. Encode these in `docs/design/DESIGN_PRINCIPLES.md` and enforce
them in code.

### 3.1 Emotional direction (from the spec, non-negotiable)
Calm · intelligent · private · **non-judgmental**. The app's job is to improve decisions,
**never to shame behavior**. A user who overspent should close the app feeling *capable*,
not caught.

### 3.2 The 15-second promise
A user must understand their entire month in ~15 seconds. Visual hierarchy on Home:

> salary status → **central "safe to spend" number** → protected obligations →
> flexible categories → future allocations → AI insight → goals

One important decision per screen section. **Numbers first, explanation second, action third.**

### 3.3 Voice — write the copy like a trusted friend who is good with money
Build `packages/ui/src/copy/voice.ts` as a real, typed copy layer — **no string literals
scattered in components.** Every user-facing sentence goes through it.

| Situation | ❌ Robot / AI-slop | ✅ Salary AI |
|---|---|---|
| Home hero | "Available Balance: 12,500.00" | "You've got **Rs 12,500** to spend freely this month." |
| Overspend | "⚠️ BUDGET EXCEEDED — Food +34%" | "Food ran over by Rs 3,400 this month. Want me to borrow it from Shopping, or raise the food budget?" |
| Payday | "Income transaction recorded." | "Salary's in. Here's what I'd do with it — change anything you like." |
| Empty state | "No data available." | "Nothing logged yet. Tell me one thing you spent today and I'll take it from there." |
| Uncertainty | "Predicted: 8,200" | "Probably around **Rs 8,000–8,500** — I'll be more precise after another month." |
| AI down | "Error 503." | "My explanations are offline right now, but your numbers and plan are all still here." |

Rules: second person ("you"), contractions, **never** exclamation-mark cheerfulness,
never the words *failed / violated / exceeded / you should have*. Show uncertainty honestly
with "likely", "estimated", or a confidence chip. Every AI recommendation carries a **"Why?"**
affordance that expands into the actual numbers it used.

### 3.4 Make it feel like it knows you
- **Time-and-context-aware greeting** — payday morning, mid-month, three days before salary,
  and a hard month all read differently.
- **Name the user's own patterns back to them**: "You usually order food on Thursdays" —
  only ever from real ledger data, never invented.
- **Memory surface**: a "What I've learned about you" screen the user can read, correct and
  delete. Correcting it should feel like *teaching*, not data cleanup — confirm with
  "Got it, I'll remember that," not a toast that says "Updated."
- **Month-end letter**: a narrative recap of the month in prose, not a chart dump.
- **Streak-free encouragement**: progress, never scores, badges or rankings.

### 3.5 Immersive but respectful (motion + depth)
- Motion must carry *meaning*: money physically **moving** between envelopes on reallocation;
  the safe-to-spend number **counting** to its new value on payday; category rings easing,
  not popping.
- Context-aware timing (~120ms micro-feedback, ~240ms transitions, ~600ms for the payday
  moment). **Never one global duration.** Animate only `transform`/`opacity`.
- Full `prefers-reduced-motion` path — not disabled animation, a designed static alternative.
- Depth through soft elevation and generous negative space; **no glassmorphism everywhere,
  no neon glow, no gradient-mesh "AI" aesthetic.**
- Haptics on consequential confirmations only.

### 3.6 Trust is a design feature
Every screen that shows a computed number must be able to answer *where did this come from*:
- "Last updated" timestamp on any synced/derived figure.
- Confidence chips (`Confident` / `Estimated` / `Learning`) on forecasts.
- "See the math" drawer exposing the deterministic finance-engine inputs.
- **Explicit approval** before any consequential action — the AI proposes, the user commits.
- A visible, boring, honest privacy surface: what's stored, export, delete.
- Trial state (3-day full-feature trial → paid) communicated **calmly and early**; never a
  dark-pattern countdown, and financial data is preserved after expiry.

### 3.7 Non-negotiable quality bar
Contrast ≥ 4.5:1 · touch targets ≥ 44×44px with ≥8px spacing · visible focus rings
(**never** `outline: none`) · dynamic type · full screen-reader labels · color always paired
with text or icon · tabular numerals for all money · locale-aware currency with **no
hard-coded PKR/USD** · dark mode designed from the start, not inverted · the core finance
app works fully when the AI is unavailable.

---

## STEP 4 — BUILD THE APP STRUCTURE

Monorepo per `04_TECHNICAL_ARCHITECTURE_CODEBASE.docx`:

```
salary-ai/
  apps/web/                 Next.js App Router, mobile-first, PWA shell
  apps/api/                 BFF + domain services
  packages/ui/              design system: tokens, primitives, patterns, copy/voice.ts
  packages/finance-engine/  PURE + fully tested: calculate_safe_to_spend,
                            calculate_month_plan, project_goal, detect_budget_variance,
                            calculate_emergency_fund_status, forecast_recurring_costs
  packages/schemas/         zod contracts shared by UI, API and AI tools
  packages/domain/          auth · profile · income · ledger · budgeting · goals ·
                            forecasting · ai · notifications · imports · admin
  docs/design/              DESIGN_PRINCIPLES · DESIGN_DECISIONS · COMPETITIVE_TEARDOWN ·
                            INSPIRATION · MOTION_SPEC · VOICE_AND_TONE · ACCESSIBILITY
  tests/                    unit · integration · evals · fixtures
```

**Three token layers** in `packages/ui`: primitive → **semantic** (`--color-safe-to-spend`,
`--color-committed`, `--color-goal`, `--color-attention`) → component.
Components consume **semantic tokens only**; a raw hex in a component is a bug.
Money is integer minor units everywhere — **never** binary floats.

**Screens to scaffold** (each with loading, empty, error, offline, reduced-motion and
dark-mode states — the spec's failure states are first-class, not afterthoughts):

1. **Onboarding** — 10 conversational steps (income → living situation → commitments →
   flexible behavior → safety → goals → preferences → behavior → first plan). One question
   per screen, progress that reassures, skippable, **no charts during onboarding**. The first
   plan is explicitly labelled an estimate that improves.
2. **Home** — the 15-second month. Hero "safe to spend", not a balance.
3. **Salary Plan** — the flagship screen. Answers "my salary came in; what happens now?"
   Interactive allocation with live-updating knock-on effects.
4. **Transactions** — text/voice capture, instant optimistic entry, one-tap recategorize
   that visibly teaches the system, duplicate-import flagging.
5. **AI Conversation** — **not a generic chatbot**: financially contextual, renders
   **action cards** ("Move Rs 1,000 to savings", "Adjust food budget") that call typed
   backend tools and require approval for consequential actions.
6. **Goals** — projection with honest ranges, not a single false-precision date.
7. **Insights / Month-end** — the narrative letter + only the charts where the trend itself
   matters.
8. **Memory & Privacy** — "What I've learned about you", export, delete.
9. **Trial & Subscription** — calm, honest, never coercive.

---

## STEP 5 — DELIVERABLES

1. Working `apps/web` I can run — bind `0.0.0.0`, mobile viewport first.
2. `packages/ui` design system with the three token layers, light + dark, and `voice.ts`.
3. `packages/finance-engine` pure and unit-tested with versioned calculations.
4. All nine screens with realistic seeded fixture data — **a plausible person's messy
   financial month**, never `Lorem ipsum`, never `$1,234.56` placeholders.
5. The `docs/design/*` set, including every skill query you ran and what you did with it.
6. `docs/design/SELF_CRITIQUE.md`: run the ui-ux-pro-max review pass over your own output
   in priority order (accessibility → touch → performance → style consistency → responsive →
   type/color → motion → forms → navigation → charts), list what failed, fix it, re-check.

## WORKING RULES

- Query the skill **before** deciding, not after — and cite it in the decision log.
- Show me the design system and one finished screen (Home) **before** building the other
  eight. Wait for my sign-off.
- Every number on screen traces to the deterministic finance engine, never to the model.
- If you're about to ship a purple gradient, a confetti burst, a shame-red banner, an emoji
  icon or the phrase "Welcome to your financial dashboard" — **stop and redesign it.**

## THE TEST TO HOLD YOURSELF TO

> A real person, three days before payday, low on money and a little anxious, opens this app.
> Do they feel **judged** — or do they feel like **someone's got their back**?

If it's the first, it isn't finished.

---END---
