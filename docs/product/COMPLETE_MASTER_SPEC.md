
## Global / world-neutral product principle

Salary AI is a global product. Pakistan may be an initial launch market, but it is not the product default. Country/region, primary currency, supported transaction currencies, language, locale, timezone and financial-service availability are configurable per user. The AI learns actual lifestyle and spending behavior from the user instead of inferring behavior from nationality. Regional banking, investment, tax, payment and regulatory capabilities are modular and jurisdiction-gated.

## Commercial rule: 3-day trial → paid

Every new user receives a 3-day free trial of the paid experience. Trial state and paid entitlements are server-authoritative. Before trial expiration the product clearly communicates the trial end and subscription terms. When the 3-day trial expires, paid features require an active subscription; financial data remains preserved. Pricing, taxes, billing currency and payment methods can vary by market.

## Product neutrality requirement

Do not hard-code PKR, USD or any single country’s category structure, calendar assumptions or lifestyle as the universal default. Use localization and regional configuration layers around a universal financial-domain model.



# 00 — 00_MASTER_HANDOFF
SALARY AI — MASTER HANDOFF
The single source of truth for an AI, product team, design team, engineering team, or founder continuing the project.
Version 1.0 • September 2026
0. Executive definition
Build a mobile-first personal finance product centered on one promise: the app learns how a specific person earns, spends, saves and plans, then turns each salary into a personalized monthly financial plan that adapts as real behavior changes.

||
|---|

1. The product loop
1. User tells the system about income, fixed commitments, goals, household responsibilities, preferences and financial behavior.
2. The deterministic finance engine builds a monthly plan: obligations, flexible spending, emergency funding, goals, investing/saving and buffer.
3. The AI explains the plan in simple, personalized language and helps the user act on it.
4. The user records transactions or imports them.
5. The system compares planned versus actual spending, detects patterns and updates the user model.
6. At month-end the AI explains what happened and proposes a better plan for the next month.
7. Over time the app becomes more accurate because it learns the individual rather than applying one universal budgeting rule.
2. What makes it different

|||
|---|---|
|||
|||
|||
|||
|||
|||
|||

3. Core screens

||||
|---|---|---|
||||
||||
||||
||||
||||
||||
||||

4. First-time user experience
1. Welcome + promise: “I’ll learn how you use money and build your monthly plan.”
2. Income: amount, frequency, payday pattern, income stability, multiple income sources.
3. Living situation: rent/mortgage, dependents, family support, debt, location/currency.
4. Recurring commitments: bills, utilities, subscriptions, transport, education, insurance, etc.
5. Flexible behavior: food, outings, shopping, entertainment, travel, hobbies.
6. Financial safety: current emergency savings, desired emergency-fund target, debt obligations.
7. Goals: short, medium and long term; target amount and target date.
8. Preferences: conservative vs ambitious saving, investment preference, religious/ethical preferences where relevant, cash-buffer preference.
9. Behavior questions: common overspending category, stress spending, end-of-month behavior, willingness to cut categories.
10. Generate the first plan and clearly label it as an initial estimate that will improve with real transaction history.
5. Non-negotiable architecture principle

||
|---|

6. MVP boundary
MVP should not attempt to become a bank, broker, payment processor or autonomous money mover. Start with manual/text/voice transaction capture, salary planning, goals, budgets, AI explanation, month-end learning and optional CSV import. Add bank aggregation and financial actions only after compliance, data-security, provider and reconciliation work is ready.
7. Definition of success

|||
|---|---|
|||
|||
|||
|||
|||
|||
|||
|||

8. Risks to design around
Over-asking during onboarding can cause abandonment.
Wrong categorization destroys trust; allow quick correction and learning from corrections.
AI hallucinations can be dangerous; every recommendation must be grounded in structured application data.
Investment/debt/tax advice may become regulated or high-risk; use appropriate disclosures, boundaries and jurisdiction-specific review.
Bank-connected data is sensitive; minimize data collection, isolate secrets, enforce tenant-level authorization and provide deletion/export controls.
Automation without user approval can turn a helpful product into a liability. Use explicit approvals for consequential actions.
Verified external inputs
Rocket Money launched Rowan in August 2026, an AI agent that monitors finances and can act on a user’s behalf. This validates that proactive financial agents are becoming a real competitive category, not a hypothetical feature.
MyHisaab currently positions itself in Pakistan around AI expense logging, budgets, monthly insights and voice/text entry.
MunshiJi currently positions itself in Pakistan around voice-first expense tracking, Roman Urdu/Urdu/English, budgeting and halal-investing features.
Origin currently markets an AI financial advisor that gives recommendations using a user’s actual financial situation.
OpenAI’s current Agents SDK documentation describes agents with tools, guardrails, sessions, handoffs/agents-as-tools and tracing. Structured outputs are appropriate when the application needs model responses to conform to schemas.
Supabase documentation currently supports Postgres, Auth and Row Level Security. RLS should be treated as a required authorization layer, not an optional enhancement.
Pakistan’s State Bank of Pakistan regulates banking/digital-finance activities. Any bank-linked or money-movement feature must be reviewed against applicable legal, licensing, partner-bank and payment-provider requirements before launch.
Sources: Rocket Companies (Rowan, Aug. 25, 2026); Rocket Money AI budgeting roundup (Aug. 31, 2026); MyHisaab; MunshiJi; Origin; OpenAI Agents SDK / Structured Outputs; Supabase Auth/RLS documentation; State Bank of Pakistan regulatory pages. Research verified September 11, 2026.


# 01 — 01_PRODUCT_VISION_PRD
PRODUCT VISION & PRD
Requirements, personas, positioning, feature system, rules and acceptance criteria.
Version 1.0 • September 2026
1. Product thesis
Most finance tools answer “Where did my money go?” This product should answer “Given who I am, what should I do with the money I have this month?” The app earns the right to personalize by continuously learning from stated facts and observed behavior.
2. User promise
“Give me your financial reality once. Then help me make better decisions every month.”
3. Target users

||||
|---|---|---|
||||
||||
||||
||||
||||
||||

4. Personas to reject in MVP
Professional wealth managers needing portfolio analytics
Businesses needing accounting
Institutional investors
Users expecting fully autonomous trading
Users in jurisdictions where required regulatory/service infrastructure is unavailable
5. Feature map

|||||
|---|---|---|---|
|||||
|||||
|||||
|||||
|||||
|||||
|||||

6. Information architecture

|||
|---|---|
|||
|||
|||
|||
|||
|||
|||

7. Core product objects

|||
|---|---|
|||
|||
|||
|||
|||
|||
|||
|||
|||
|||
|||

8. Product rules
1. Essential obligations are protected before flexible spending suggestions.
2. The system must distinguish facts the user supplied from facts inferred from behavior.
3. Every important inference should carry confidence and a way to correct it.
4. Every recommendation must be reproducible from structured inputs; store a calculation snapshot.
5. Never hide why a recommendation changed materially.
6. Budget suggestions should adapt gradually to avoid wild swings from one unusual month.
7. When uncertainty is high, the app should ask a focused question instead of pretending certainty.
8. Consequential financial actions require explicit user approval unless a future legally reviewed feature is specifically designed for delegated authorization.
9. Example decision

||
|---|

10. Definition of Done for MVP
1. A user can register, complete onboarding and create a monthly salary plan.
2. A user can record transactions in under 10 seconds by text and under 15 seconds by voice.
3. The app shows category budgets, actuals and remaining amounts.
4. The app provides a safe-to-spend number backed by deterministic calculations.
5. The AI can answer financial questions using only retrieved user-specific context.
6. The app produces a month-end summary and next-month plan recommendation.
7. All user-owned records are tenant-isolated and auditable.
8. Users can export/delete their data according to the product privacy policy.
9. Critical finance calculations have automated tests and independent fixtures.
Verified external inputs
Rocket Money launched Rowan in August 2026, an AI agent that monitors finances and can act on a user’s behalf. This validates that proactive financial agents are becoming a real competitive category, not a hypothetical feature.
MyHisaab currently positions itself in Pakistan around AI expense logging, budgets, monthly insights and voice/text entry.
MunshiJi currently positions itself in Pakistan around voice-first expense tracking, Roman Urdu/Urdu/English, budgeting and halal-investing features.
Origin currently markets an AI financial advisor that gives recommendations using a user’s actual financial situation.
OpenAI’s current Agents SDK documentation describes agents with tools, guardrails, sessions, handoffs/agents-as-tools and tracing. Structured outputs are appropriate when the application needs model responses to conform to schemas.
Supabase documentation currently supports Postgres, Auth and Row Level Security. RLS should be treated as a required authorization layer, not an optional enhancement.
Pakistan’s State Bank of Pakistan regulates banking/digital-finance activities. Any bank-linked or money-movement feature must be reviewed against applicable legal, licensing, partner-bank and payment-provider requirements before launch.
Sources: Rocket Companies (Rowan, Aug. 25, 2026); Rocket Money AI budgeting roundup (Aug. 31, 2026); MyHisaab; MunshiJi; Origin; OpenAI Agents SDK / Structured Outputs; Supabase Auth/RLS documentation; State Bank of Pakistan regulatory pages. Research verified September 11, 2026.


# 02 — 02_UX_UI_EXPERIENCE
UX/UI & EXPERIENCE SYSTEM
How the product should feel, how screens behave, and how the user should think about money inside the app.
Version 1.0 • September 2026
1. Emotional direction
The app should feel calm, intelligent, private and non-judgmental. Never make the user feel “bad” because they spent money. The product’s job is to improve decisions, not shame behavior.
2. UX principles
One important decision per screen section.
Numbers first, explanation second, action third.
Use plain language: “You have Rs. 12,500 left for flexible spending” instead of financial jargon.
Do not flood users with charts during onboarding.
Show uncertainty honestly: “likely,” “estimated,” or a confidence indicator when appropriate.
Every important AI recommendation should have “Why?” available.
Corrections should teach the system instead of feeling like data cleanup.
3. Home dashboard

||||
|---|---|---|
||||
||||
||||
||||
||||
||||

4. Salary Plan screen
This is the hero screen of the product. It should answer: “My salary came in; what happens now?”

|||
|---|---|
|||
|||
|||
|||
|||
|||
|||

5. Transaction entry

||||
|---|---|---|
||||
||||
||||
||||

6. AI conversation UX
The AI should not look like a generic chatbot. It should operate inside the financial context of the app. Use action cards after answers: “Move Rs. 1,000 to savings”, “Create a goal”, “Adjust food budget”, etc. These actions must invoke backend tools and require approval when consequential.
7. Onboarding flow

||||
|---|---|---|
||||
||||
||||
||||
||||
||||
||||
||||

8. Design system
Typography: highly readable modern sans-serif; strong hierarchy, generous spacing.
Cards: restrained use. Prefer a few meaningful panels over a dashboard of tiny widgets.
Numbers: tabular numerals where possible; clear currency formatting with locale support.
Status colors: use color as a secondary signal; pair with text/icons for accessibility.
Charts: use when the trend itself matters; do not chart every metric.
Motion: subtle transitions for plan updates, category progress and approvals; no distracting gamification.
Dark mode: design from the start, especially for mobile users.
Accessibility: touch targets, dynamic type, contrast, screen-reader labels and reduced-motion support.
9. Tone of voice

||||
|---|---|---|
||||
||||
||||
||||

10. Example visual hierarchy for the flagship month
Top: salary status → central “safe to spend” number → protected obligations → flexible categories → future allocations → AI insight → goals. The screen should let a user understand their entire month in roughly 15 seconds.
11. UX failure states
No salary yet: show expected plan, not zeros.
Missing category: ask for classification at point of relevance.
Uncertain recurring bill: show range and confidence.
Imported duplicate: flag probable duplicate before counting.
AI unavailable: the core finance app still works.
Data sync delayed: show last updated timestamp.
Verified external inputs
Rocket Money launched Rowan in August 2026, an AI agent that monitors finances and can act on a user’s behalf. This validates that proactive financial agents are becoming a real competitive category, not a hypothetical feature.
MyHisaab currently positions itself in Pakistan around AI expense logging, budgets, monthly insights and voice/text entry.
MunshiJi currently positions itself in Pakistan around voice-first expense tracking, Roman Urdu/Urdu/English, budgeting and halal-investing features.
Origin currently markets an AI financial advisor that gives recommendations using a user’s actual financial situation.
OpenAI’s current Agents SDK documentation describes agents with tools, guardrails, sessions, handoffs/agents-as-tools and tracing. Structured outputs are appropriate when the application needs model responses to conform to schemas.
Supabase documentation currently supports Postgres, Auth and Row Level Security. RLS should be treated as a required authorization layer, not an optional enhancement.
Pakistan’s State Bank of Pakistan regulates banking/digital-finance activities. Any bank-linked or money-movement feature must be reviewed against applicable legal, licensing, partner-bank and payment-provider requirements before launch.
Sources: Rocket Companies (Rowan, Aug. 25, 2026); Rocket Money AI budgeting roundup (Aug. 31, 2026); MyHisaab; MunshiJi; Origin; OpenAI Agents SDK / Structured Outputs; Supabase Auth/RLS documentation; State Bank of Pakistan regulatory pages. Research verified September 11, 2026.


# 03 — 03_AI_SYSTEM_PERSONALIZATION
AI SYSTEM & PERSONALIZATION SPEC
The AI is an intelligent layer over deterministic financial data, not the source of truth.
Version 1.0 • September 2026
1. AI architecture principle
Use a hybrid system: deterministic finance services calculate truth; retrieval supplies user-specific facts; the LLM interprets, explains, asks questions, classifies ambiguous inputs and produces structured recommendations; policy/guardrail services constrain risky outputs.
2. Recommended AI components

|||
|---|---|
|||
|||
|||
|||
|||
|||
|||

3. Do not build “one giant prompt”
The system prompt should define role, boundaries and tool rules. User-specific financial facts should arrive as structured context from the backend. Long-lived facts belong in a profile store, not in an ever-growing chat history.
4. Financial memory model

|||||
|---|---|---|---|
|||||
|||||
|||||
|||||
|||||

5. Learning loop
1. Observe transaction.
2. Classify transaction with confidence and allow correction.
3. Aggregate daily/weekly/monthly features.
4. Compare actual behavior with the current profile.
5. Detect stable pattern only after sufficient evidence; avoid overreacting to one event.
6. Create a candidate profile update with provenance.
7. Use the updated profile to improve next month’s recommendation.
8. Show material profile changes to the user: “I noticed your transport costs are usually higher than we estimated. Update your baseline?”
6. Personalization feature examples

|||
|---|---|
|||
|||
|||
|||
|||
|||
|||
|||

7. Tool contract examples
The model should call tools such as: get_month_plan, get_safe_to_spend, get_category_status, list_upcoming_obligations, get_goal_projection, search_transactions, classify_transaction, propose_budget_adjustment, create_goal_draft, create_plan_draft. Write operations should normally create drafts first; the client asks the user to approve consequential actions.
8. Structured output contract
Every AI recommendation should be representable as typed JSON, for example: recommendation_type, title, explanation, amount, currency, affected_categories, source_metrics, confidence, user_action_required, proposed_action, calculation_id, safety_flags. The app should render these fields rather than trying to parse arbitrary prose.
9. Guardrails
Never invent balances, transactions, bills, rates, goals or account details.
Never claim a calculation that the backend did not provide.
Never expose raw secrets, bank credentials or full account identifiers to the model.
Do not make regulated investment/tax/legal claims beyond approved product scope.
For ambiguous transaction inputs, ask a short clarifying question or mark low confidence.
For high-impact recommendations, include rationale and user approval state.
Log tool calls and model outputs in a privacy-conscious evaluation system; avoid retaining sensitive model traces unnecessarily.
10. Agent orchestration recommendation
Start with a manager-style agent that remains responsible for the final answer and uses specialist agents as tools. This fits a finance assistant because the user should experience one coherent assistant while specialists handle classification, planning and analysis. Handoffs are useful later when a specialist genuinely needs to take over a conversation.
11. Evaluation suite

|||
|---|---|
|||
|||
|||
|||
|||
|||
|||
|||

Verified external inputs
Rocket Money launched Rowan in August 2026, an AI agent that monitors finances and can act on a user’s behalf. This validates that proactive financial agents are becoming a real competitive category, not a hypothetical feature.
MyHisaab currently positions itself in Pakistan around AI expense logging, budgets, monthly insights and voice/text entry.
MunshiJi currently positions itself in Pakistan around voice-first expense tracking, Roman Urdu/Urdu/English, budgeting and halal-investing features.
Origin currently markets an AI financial advisor that gives recommendations using a user’s actual financial situation.
OpenAI’s current Agents SDK documentation describes agents with tools, guardrails, sessions, handoffs/agents-as-tools and tracing. Structured outputs are appropriate when the application needs model responses to conform to schemas.
Supabase documentation currently supports Postgres, Auth and Row Level Security. RLS should be treated as a required authorization layer, not an optional enhancement.
Pakistan’s State Bank of Pakistan regulates banking/digital-finance activities. Any bank-linked or money-movement feature must be reviewed against applicable legal, licensing, partner-bank and payment-provider requirements before launch.
Sources: Rocket Companies (Rowan, Aug. 25, 2026); Rocket Money AI budgeting roundup (Aug. 31, 2026); MyHisaab; MunshiJi; Origin; OpenAI Agents SDK / Structured Outputs; Supabase Auth/RLS documentation; State Bank of Pakistan regulatory pages. Research verified September 11, 2026.


# 04 — 04_TECHNICAL_ARCHITECTURE_CODEBASE
TECHNICAL ARCHITECTURE & CODEBASE
A practical production architecture with an MVP path and clear future expansion.
Version 1.0 • September 2026
1. Recommended stack

||||
|---|---|---|
||||
||||
||||
||||
||||
||||
||||
||||
||||
||||
||||

2. Architecture diagram in words
Mobile/Web clients → API gateway/BFF → Auth/Authorization → Domain services → PostgreSQL. Domain services call deterministic finance engine, transaction pipeline and notification services. AI orchestration reads only approved structured context and calls typed tools. Background workers handle imports, recurring-item detection, monthly rollovers and notifications.
3. Domain modules
1. auth — sessions, device security, recovery, consent.
2. profile — user facts, preferences, locale, currency.
3. income — income sources, pay schedules, income events.
4. ledger — transactions, categories, transfers, adjustments.
5. budgeting — category budgets, month plans, variances.
6. goals — targets, progress, contributions, projections.
7. forecasting — recurring items, cash-flow projections, ranges.
8. ai — prompts, tool contracts, orchestration, memory retrieval, evals.
9. notifications — push/email/in-app events.
10. imports — CSV/receipt ingestion and reconciliation.
11. admin — support, moderation, feature flags, audit tooling.
4. Suggested repository
Use a monorepo to share types and validation between mobile, web and backend.
salary-ai/  apps/    mobile/    web/    admin/    api/    ai-worker/  packages/    ui/    domain/    schemas/    finance-engine/    ai-contracts/    config/  infra/    migrations/    docker/    terraform/  docs/    product/    architecture/    prompts/    runbooks/  tests/    unit/    integration/    evals/    fixtures/
5. Database principles
Use UUID/ULID identifiers; keep user ownership explicit on every user-scoped table.
Use integer minor units or fixed-precision numeric for money; never binary floating point for persisted money calculations.
Store transaction source and import idempotency keys.
Version monthly plans so users can understand what changed.
Record timestamps in UTC plus the user timezone for presentation rules.
Separate sensitive connection credentials/tokens from ordinary financial records.
Add indexes based on real query patterns: user_id + date, category + date, recurring flags, goal status.
6. Finance engine
The finance engine should be a pure, heavily tested module. Example functions: calculate_safe_to_spend(), calculate_month_plan(), project_goal(), detect_budget_variance(), calculate_emergency_fund_status(), forecast_recurring_costs(). Each function should accept typed inputs and return typed outputs with a calculation version.
7. API contract examples

|||
|---|---|
|||
|||
|||
|||
|||
|||
|||
|||
|||
|||

8. Security baseline
TLS everywhere; encrypt sensitive data at rest.
Short-lived access tokens with refresh/session rotation.
Rate limiting and abuse protection on auth and AI endpoints.
Server-side authorization checks even when database RLS exists.
Secret management via environment/secret manager, never source control.
Audit events for logins, data export/delete, plan approvals and consequential actions.
Dependency scanning, SAST, secret scanning and container scanning in CI.
Separate production from development data; never use real user data in local fixtures.
9. Infrastructure stages

|||
|---|---|
|||
|||
|||
|||

10. Engineering rules
1. Business logic belongs in domain modules, not UI components.
2. All AI tool arguments are schema validated.
3. Every calculation has tests and a version.
4. Every migration is reversible or has a clear remediation plan.
5. Never silently alter historical transaction values; use corrections/adjustments with audit trails.
6. Prefer explicit state machines for plan/action approval rather than loosely interpreted booleans.
Verified external inputs
Rocket Money launched Rowan in August 2026, an AI agent that monitors finances and can act on a user’s behalf. This validates that proactive financial agents are becoming a real competitive category, not a hypothetical feature.
MyHisaab currently positions itself in Pakistan around AI expense logging, budgets, monthly insights and voice/text entry.
MunshiJi currently positions itself in Pakistan around voice-first expense tracking, Roman Urdu/Urdu/English, budgeting and halal-investing features.
Origin currently markets an AI financial advisor that gives recommendations using a user’s actual financial situation.
OpenAI’s current Agents SDK documentation describes agents with tools, guardrails, sessions, handoffs/agents-as-tools and tracing. Structured outputs are appropriate when the application needs model responses to conform to schemas.
Supabase documentation currently supports Postgres, Auth and Row Level Security. RLS should be treated as a required authorization layer, not an optional enhancement.
Pakistan’s State Bank of Pakistan regulates banking/digital-finance activities. Any bank-linked or money-movement feature must be reviewed against applicable legal, licensing, partner-bank and payment-provider requirements before launch.
Sources: Rocket Companies (Rowan, Aug. 25, 2026); Rocket Money AI budgeting roundup (Aug. 31, 2026); MyHisaab; MunshiJi; Origin; OpenAI Agents SDK / Structured Outputs; Supabase Auth/RLS documentation; State Bank of Pakistan regulatory pages. Research verified September 11, 2026.


# 05 — 05_DELIVERY_ROADMAP_TEAM
DELIVERY ROADMAP & TEAM PLAN
A phased build plan designed for a real product team.
Version 1.0 • September 2026
1. Team model: 50-person “company brain”
The product can be designed as though 50 specialists are advising the work, but the actual build should begin lean. The following roles define the expertise that should be represented in decisions.

||||
|---|---|---|
||||
||||
||||
||||
||||
||||
||||
||||
||||
||||

2. Phase 0 — Discovery & validation
Goal: prove people want an adaptive salary manager before building complex bank integrations.
Interview target users
Prototype onboarding and salary plan
Test “Can I spend this?” concept
Measure willingness to trust AI recommendations
Define launch jurisdiction and compliance perimeter
Create competitive positioning
3. Phase 1 — Prototype
Build clickable UX plus a simple working finance engine. No bank connections. Use seeded/demo transactions.

|||
|---|---|
|||
|||
|||
|||
|||

4. Phase 2 — MVP engineering
1. Auth and user profile.
2. Salary/income setup.
3. Transaction capture and editing.
4. Categories and recurring items.
5. Monthly plan generator.
6. Goals.
7. Safe-to-spend.
8. AI assistant with typed tools.
9. Month-end learning and plan regeneration.
10. Analytics, logging, support/admin tools.
11. Security/privacy baseline and data export/delete.
5. Phase 3 — Beta
Recruit a small cohort
Measure onboarding drop-off
Tune category model
Tune planning rules
Track recommendation acceptance and correction rate
Run red-team prompts against AI
Perform privacy/security review
Stress-test monthly rollover
6. Phase 4 — Launch
Launch only after the team can explain every major number shown in the app and reproduce the calculation from stored facts. A polished UI is not enough; financial trust is the product.
7. Phase 5 — Bank data and automation
Only after the core product demonstrates retention should the team evaluate account aggregation, open-banking/bank integrations, automated savings transfers or other external actions. Treat each provider and jurisdiction as a separate integration/compliance project.
8. Release gates

|||
|---|---|
|||
|||
|||
|||
|||
|||

9. Suggested sprint rhythm
1. Monday: product/design/engineering planning
2. Daily: short engineering sync
3. Mid-sprint: UX review + AI eval review
4. Thursday: integrated build test
5. Friday: demo + metrics review + next-week decisions
10. What not to build too early
Autonomous transfers
Complex investments
Huge category trees
Social features
Gamified leaderboards
Cryptocurrency
A dozen voice modes
Full accounting
Multi-country banking at once
11. Definition of “ready to scale”
Retention, recommendation usefulness, transaction-entry speed, calculation reliability, security posture and unit economics should improve before feature breadth.
Verified external inputs
Rocket Money launched Rowan in August 2026, an AI agent that monitors finances and can act on a user’s behalf. This validates that proactive financial agents are becoming a real competitive category, not a hypothetical feature.
MyHisaab currently positions itself in Pakistan around AI expense logging, budgets, monthly insights and voice/text entry.
MunshiJi currently positions itself in Pakistan around voice-first expense tracking, Roman Urdu/Urdu/English, budgeting and halal-investing features.
Origin currently markets an AI financial advisor that gives recommendations using a user’s actual financial situation.
OpenAI’s current Agents SDK documentation describes agents with tools, guardrails, sessions, handoffs/agents-as-tools and tracing. Structured outputs are appropriate when the application needs model responses to conform to schemas.
Supabase documentation currently supports Postgres, Auth and Row Level Security. RLS should be treated as a required authorization layer, not an optional enhancement.
Pakistan’s State Bank of Pakistan regulates banking/digital-finance activities. Any bank-linked or money-movement feature must be reviewed against applicable legal, licensing, partner-bank and payment-provider requirements before launch.
Sources: Rocket Companies (Rowan, Aug. 25, 2026); Rocket Money AI budgeting roundup (Aug. 31, 2026); MyHisaab; MunshiJi; Origin; OpenAI Agents SDK / Structured Outputs; Supabase Auth/RLS documentation; State Bank of Pakistan regulatory pages. Research verified September 11, 2026.


# 06 — 06_BUSINESS_MODEL_GTM
BUSINESS MODEL, POSITIONING & GO-TO-MARKET
How to turn the product into a differentiated business without losing the core trust promise.
Version 1.0 • September 2026
1. Positioning

||
|---|

2. Category strategy
Do not compete head-on by claiming to be the best generic budgeting dashboard. The category wedge is salary-centric personalization: “What should I do with this month’s income?”
3. Competitive landscape

||||
|---|---|---|
||||
||||
||||
||||

4. Market lesson
AI finance is already crowded. A defensible product needs proprietary behavioral data structures, better personalization, reliable calculations, excellent UX, local market fit and trust—not merely access to an LLM.
5. Monetization options

|||
|---|---|
|||
|||
|||
|||

6. Suggested packaging
Free: transactions, basic budgets, first salary plan. Plus: adaptive monthly plans, proactive insights, advanced goals, longer history, voice, scenarios. Pro/Advisor: human review or advanced regulated services later. Pricing should be validated rather than copied from competitors.
7. Acquisition
Short-form content: salary breakdowns and “what should I do with Rs. X?” examples
Interactive website demo of the salary planner
Referral: invite a friend and compare planning habits, not account balances
Localized content for Pakistan first if Pakistan is the launch market
Creator partnerships focused on practical personal finance, not hype
8. Retention loop
1. Payday plan notification
2. Daily/weekly safe-to-spend check
3. Mid-month adjustment when behavior changes
4. Goal progress reminder
5. Month-end review
6. Next-month plan generated from learned behavior
9. Trust positioning
The brand should explicitly state: calculations are generated by the app’s financial engine; AI explains recommendations; users control approvals; data is private; uncertainty is shown rather than hidden.
10. Metrics

|||
|---|---|
|||
|||
|||
|||
|||
|||
|||
|||

11. Moat roadmap
Year 1 moat: trust + UX + user financial profile model. Year 2: richer behavior prediction + integrations + local knowledge. Later: regulated partnerships, automated workflows and proprietary recommendation/evaluation datasets, subject to lawful data practices.
Verified external inputs
Rocket Money launched Rowan in August 2026, an AI agent that monitors finances and can act on a user’s behalf. This validates that proactive financial agents are becoming a real competitive category, not a hypothetical feature.
MyHisaab currently positions itself in Pakistan around AI expense logging, budgets, monthly insights and voice/text entry.
MunshiJi currently positions itself in Pakistan around voice-first expense tracking, Roman Urdu/Urdu/English, budgeting and halal-investing features.
Origin currently markets an AI financial advisor that gives recommendations using a user’s actual financial situation.
OpenAI’s current Agents SDK documentation describes agents with tools, guardrails, sessions, handoffs/agents-as-tools and tracing. Structured outputs are appropriate when the application needs model responses to conform to schemas.
Supabase documentation currently supports Postgres, Auth and Row Level Security. RLS should be treated as a required authorization layer, not an optional enhancement.
Pakistan’s State Bank of Pakistan regulates banking/digital-finance activities. Any bank-linked or money-movement feature must be reviewed against applicable legal, licensing, partner-bank and payment-provider requirements before launch.
Sources: Rocket Companies (Rowan, Aug. 25, 2026); Rocket Money AI budgeting roundup (Aug. 31, 2026); MyHisaab; MunshiJi; Origin; OpenAI Agents SDK / Structured Outputs; Supabase Auth/RLS documentation; State Bank of Pakistan regulatory pages. Research verified September 11, 2026.


# 07 — 07_SECURITY_PRIVACY_FINTECH_RISK
SECURITY, PRIVACY & FINTECH RISK
Controls required when handling sensitive personal financial data.
Version 1.0 • September 2026
1. Threat model

||||
|---|---|---|
||||
||||
||||
||||
||||
||||
||||
||||

2. Data classification

||||
|---|---|---|
||||
||||
||||
||||

3. Privacy principles
Collect only data needed for a feature.
Explain why onboarding questions are asked.
Let users edit derived profile facts.
Provide export and deletion controls.
Do not sell or expose raw financial data through advertising systems.
Keep AI context minimal: retrieve what is needed for the current task.
4. AI-specific security
1. Treat all user-provided text as untrusted input.
2. Never allow the model to select arbitrary database queries.
3. Use typed tools with allowlisted operations.
4. Validate tool outputs before they are shown or acted on.
5. Keep sensitive credentials completely outside model context.
6. Maintain AI evaluation fixtures for jailbreaks, injection and data-exfiltration attempts.
5. Financial advice boundary
The product can provide personalized budgeting and planning guidance, but features touching investments, credit, tax, insurance, money movement or financial products can trigger additional legal/regulatory requirements. The product team must define an approved advice taxonomy and review launch-country obligations with qualified counsel before enabling those capabilities.
6. Pakistan launch note
For the first launch market, configure the product around that market’s currency, spending context and legal requirements, while keeping the core architecture world-neutral. Do not assume that localizing UI makes financial integrations legally straightforward. Bank connectivity, payments, digital banking, investment products and money movement may involve regulated institutions, licensed partners and applicable State Bank of Pakistan requirements.
7. Incident response

|||
|---|---|
|||
|||
|||
|||

8. Compliance documentation set
Privacy policy
Terms of service
AI disclosure / limitations
Data retention schedule
Subprocessor/vendor register
Security policy
Incident response plan
Data deletion/export procedure
Advice and product eligibility policy
Verified external inputs
Rocket Money launched Rowan in August 2026, an AI agent that monitors finances and can act on a user’s behalf. This validates that proactive financial agents are becoming a real competitive category, not a hypothetical feature.
MyHisaab currently positions itself in Pakistan around AI expense logging, budgets, monthly insights and voice/text entry.
MunshiJi currently positions itself in Pakistan around voice-first expense tracking, Roman Urdu/Urdu/English, budgeting and halal-investing features.
Origin currently markets an AI financial advisor that gives recommendations using a user’s actual financial situation.
OpenAI’s current Agents SDK documentation describes agents with tools, guardrails, sessions, handoffs/agents-as-tools and tracing. Structured outputs are appropriate when the application needs model responses to conform to schemas.
Supabase documentation currently supports Postgres, Auth and Row Level Security. RLS should be treated as a required authorization layer, not an optional enhancement.
Pakistan’s State Bank of Pakistan regulates banking/digital-finance activities. Any bank-linked or money-movement feature must be reviewed against applicable legal, licensing, partner-bank and payment-provider requirements before launch.
Sources: Rocket Companies (Rowan, Aug. 25, 2026); Rocket Money AI budgeting roundup (Aug. 31, 2026); MyHisaab; MunshiJi; Origin; OpenAI Agents SDK / Structured Outputs; Supabase Auth/RLS documentation; State Bank of Pakistan regulatory pages. Research verified September 11, 2026.


# 08 — 08_AI_BUILD_INSTRUCTIONS
AI BUILD INSTRUCTIONS
A reusable specification to give GPT/Astra or another coding/design AI so it can continue the project without inventing requirements.
Version 1.0 • September 2026
SYSTEM ROLE
You are the lead product architect, senior engineer, product designer, AI engineer, QA lead and fintech-risk-aware reviewer for Salary AI. Treat the project documents as the source of truth. Do not invent major product behavior when a rule already exists. When a requirement is missing, make the safest reversible assumption and label it explicitly.
PRIMARY MISSION
Build an AI Salary Manager that learns an individual’s income, obligations, spending behavior, goals and preferences, then creates adaptive monthly plans and explains financial decisions using deterministic application data.
NON-NEGOTIABLE RULES
1. The finance engine is the source of truth for money calculations.
2. Never let an LLM directly author persisted financial truth without validation.
3. Use typed schemas for AI outputs and tool calls.
4. User-owned data must be tenant-isolated.
5. Every consequential action is drafted before approval unless an explicitly reviewed future feature says otherwise.
6. Distinguish explicit user facts from inferred behavioral features.
7. Show why important recommendations changed.
8. Design mobile-first and keep the core flow understandable in seconds.
9. Do not build bank integrations before the MVP proves the salary-planning loop.
10. When making technical changes, update tests and documentation together.
WHAT TO BUILD FIRST
1. Repository + CI
2. Auth/profile
3. Finance domain + money type
4. Income/payday
5. Categories + transactions
6. Monthly plan engine
7. Safe-to-spend
8. Goals
9. AI tools and grounded assistant
10. Month-end learning
11. Analytics/evals
12. Security/privacy controls
EXPECTED DELIVERABLE FORMAT FOR IMPLEMENTATION TASKS
For each implementation request: state the affected module(s), list assumptions, implement the smallest production-quality change, add meaningful tests, run relevant checks, then summarize what changed and any unresolved risk. Do not rewrite unrelated code.
WHEN ASKED TO DESIGN UI
Prefer a calm financial dashboard with one hero decision per screen. Prioritize safe-to-spend, protected obligations, plan progress and goals. Do not create dense chart walls. Use accessible color/status communication and responsive behavior.
WHEN ASKED TO IMPLEMENT AI
Define the tool contract first. Retrieve only needed user data. Have the model produce structured outputs. Validate them. Use backend calculations. Add an eval fixture for the new behavior. Keep prompts versioned.
WHEN ASKED TO CHANGE BUSINESS LOGIC
Write the rule in plain language first, then encode it in the finance engine, then add edge-case tests. Do not change business logic inside prompts only.
WHEN UNSURE
Do not silently invent a financial rule. Prefer a configurable policy with a documented default. Flag regulatory questions for human/legal review.
REFERENCE SOURCES
Use the companion documents 00–07 as the working specification. Current external references include OpenAI Agents SDK/Structured Outputs documentation, Supabase Auth/RLS documentation, Rocket Money/Rowan, MyHisaab, MunshiJi, Origin and State Bank of Pakistan regulatory information, verified September 11, 2026.
FIRST 20 QUESTIONS THE TEAM SHOULD ANSWER BEFORE BUILD
1. Launch country and exact first user segment?
2. Manual transactions only or CSV import in MVP?
3. Will voice input be MVP?
4. Which currencies besides PKR are required at launch?
5. What is the exact definition of “safe to spend”?
6. How is emergency fund target selected?
7. How are irregular annual expenses represented?
8. What counts as a fixed obligation?
9. How should shared/family expenses be modeled?
10. How should debt minimums and debt payoff priorities work?
11. What investment-related content is allowed at launch?
12. Which advice categories require human/legal review?
13. What data can be sent to the AI provider?
14. What data retention period is acceptable?
15. What is the AI evaluation benchmark?
16. What is the default category taxonomy?
17. How does the system detect and confirm recurring bills?
18. How does the user override AI recommendations?
19. What notification frequency is acceptable?
20. What are the launch success metrics and kill criteria?
Verified external inputs
Rocket Money launched Rowan in August 2026, an AI agent that monitors finances and can act on a user’s behalf. This validates that proactive financial agents are becoming a real competitive category, not a hypothetical feature.
MyHisaab currently positions itself in Pakistan around AI expense logging, budgets, monthly insights and voice/text entry.
MunshiJi currently positions itself in Pakistan around voice-first expense tracking, Roman Urdu/Urdu/English, budgeting and halal-investing features.
Origin currently markets an AI financial advisor that gives recommendations using a user’s actual financial situation.
OpenAI’s current Agents SDK documentation describes agents with tools, guardrails, sessions, handoffs/agents-as-tools and tracing. Structured outputs are appropriate when the application needs model responses to conform to schemas.
Supabase documentation currently supports Postgres, Auth and Row Level Security. RLS should be treated as a required authorization layer, not an optional enhancement.
Pakistan’s State Bank of Pakistan regulates banking/digital-finance activities. Any bank-linked or money-movement feature must be reviewed against applicable legal, licensing, partner-bank and payment-provider requirements before launch.
Sources: Rocket Companies (Rowan, Aug. 25, 2026); Rocket Money AI budgeting roundup (Aug. 31, 2026); MyHisaab; MunshiJi; Origin; OpenAI Agents SDK / Structured Outputs; Supabase Auth/RLS documentation; State Bank of Pakistan regulatory pages. Research verified September 11, 2026.
