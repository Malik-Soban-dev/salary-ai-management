# Store listing copy — Google Play & Apple App Store

Ready-to-paste text for both consoles. Keep within character limits:
Play short description ≤ 80, full description ≤ 4000; App Store subtitle ≤ 30,
description ≤ 4000, keywords ≤ 100 (comma-separated, no spaces).

---

## App name
- **Play:** `Salary AI — Salary Planner` (≤30)
- **App Store:** `Salary AI` + subtitle `Turn salary into a plan` (30)

## Short description (Play, 80 chars)
> Salary in, calm plan out. Safe-to-spend, goals and an assistant that knows.

## Keywords (iOS, ≤100)
`salary,budget,planner,money,spending,goals,savings,payday,finance,expenses`

## Full description
Turn each salary into a plan that actually survives the month.

Salary AI protects what matters first — rent, utilities, the commitments you
tell it about — then funds your emergency cushion and goals, and shows you one
honest number for everything else: **safe to spend**.

WHAT YOU GET
• Safe-to-spend, recalculated daily — with a realistic per-day pace, not a
  number that abandons you halfway through the month
• A monthly plan in seconds: protected money, future money, life spending
• Quick-add from text: type "spent 950 on dinner" and the app figures out the
  amount and category — Roman-Urdu phrasing works too
• It learns: your corrections quietly rebalance next month's plan (gradually —
  no wild swings from one unusual month)
• Month-end review: what you planned vs. what happened, and a one-tap rollover
  into next month's plan
• An assistant grounded in your real numbers — ask "can I spend 5000 on
  shoes?" and get an answer from your plan, not generic advice

HONEST BY DESIGN
• No bank connection needed — you stay in control of what's recorded
• The app never moves money; it only plans
• Your currency, language and timezone — the app adapts to you, not the
  reverse
• Start with a 3-day free trial; continue with a subscription

Try it: enter your salary, add your rent and utilities, approve your first
plan. That's it — from payday to a plan in about two minutes.

## Screenshots checklist (both stores; 6.7" iPhone + 6.4–6.7" Android minimum)
1. Home — the safe-to-spend hero (money shot)
2. Plan — approved plan with protected/future/flexible sections
3. Spend — text parser preview saving a transaction
4. Insights — month-end review with learning proposals
5. Assistant — a grounded Q&A exchange
6. Trial/subscribe sheet
Use a device or emulator with populated demo data (the API seeder), light
background, no personal data.

## Google Play Data safety form
- Does your app collect or share user data? **Yes**
- Collected: **Email** (account mgmt), **Financial info — user financial info**
  (app functionality), **App activity — in-app messages** (app functionality)
- Shared: **No** (AI provider processes messages on your behalf, no identity
  attached; if Play pushes back, declare "App functionality" sharing with
  "Data processed per developer instructions, not linked to identity")
- All data **encrypted in transit**: Yes
- **Deletion request mechanism**: Yes (in-app + email)
- Data **not sold**, **not used for ads**, no trackers.

## Apple App Privacy labels
- **Contact Info → Email Address**: App Functionality
- **Financial Info → Other Financial Info** (salary, commitments, spending
  entries): App Functionality
- **User Content → Other User Content** (assistant messages): App
  Functionality
- Not linked to identity: No (linked — it's the user's own plan)
- Tracking: **No**

## Content rating
- Play questionnaire: no objectionable content → **Everyone / 3+**
- Apple age rating: **4+** (no gambling, no unrestricted web access, no
  user-generated content sharing between users)

## Review notes (paste into both consoles)
> Demo account: email `demo@salaryai.app` / password `Demo1234!`
> (create it once via the web client using the demo seeder, or register a
> fresh account and complete the 4-step onboarding — takes ~1 minute).
> The app is a planning tool only: no bank connections, no money movement.
> Trial is 3 days; subscription purchase is currently a mock endpoint in
> TestFlight/sandbox builds — see below.

## ⚠️ One thing to resolve before PRODUCTION submission
The in-app "Subscribe" button currently calls the mock checkout endpoint
(billing.status → active). For review:
- **Play:** Google Play Billing is required for digital subscriptions; wire
  the `play_store` provider in `platform.ts` to Play Billing server-side
  verification before the production release, or launch with feature
  disabled + "coming soon" (risky — stores may reject a paywall without
  real IAP; recommended: wire real IAP).
- **Apple:** same — StoreKit 2 subscription + `app_store` provider.
- Alternative early access: ship as **free during pilot** (mock checkout =
  everyone active), switch to real IAP in an update. Fine for closed
  testing on both stores.
