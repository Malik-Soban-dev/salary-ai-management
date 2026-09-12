# Salary AI — AI Handoff Index

This folder contains the working specifications for a mobile-first AI Salary Manager. The product is not a generic expense tracker. Its core loop is: **salary arrives → personalized allocation → spending → learning → adaptive next-month plan**.

## Global product rule

The app is **world-neutral**. Pakistan can be an initial launch market, but no country is the universal default. Country/region, currency, language and timezone are user settings, while behavior is learned from the individual. Regional financial capabilities are modular and compliance-gated.

## Commercial rule

Every new user gets a **3-day full-feature trial**. After the trial ends, continued product use requires an **active paid subscription**. Trial/subscription state is server-authoritative and separate from the finance ledger.

## Documents

1. `00_MASTER_HANDOFF.docx` — source-of-truth product definition.
2. `01_PRODUCT_VISION_PRD.docx` — requirements, personas, feature map and acceptance criteria.
3. `02_UX_UI_EXPERIENCE.docx` — screen structure, user journey and design system principles.
4. `03_AI_SYSTEM_PERSONALIZATION.docx` — memory model, agent/tool architecture, guardrails and evaluations.
5. `04_TECHNICAL_ARCHITECTURE_CODEBASE.docx` — stack, modules, database, API and repository structure.
6. `05_DELIVERY_ROADMAP_TEAM.docx` — phased build plan and team disciplines.
7. `06_BUSINESS_MODEL_GTM.docx` — positioning, competition, monetization and growth.
8. `07_SECURITY_PRIVACY_FINTECH_RISK.docx` — threat model, privacy and fintech-risk boundary.
9. `08_AI_BUILD_INSTRUCTIONS.docx` — direct continuation instructions for GPT/Astra/other coding AIs.
10. `09_COMPLETE_MASTER_SPEC.md` — consolidated AI-readable specification.

## Critical principle

Deterministic application code is the source of truth for financial calculations. The AI is the reasoning/explanation/interaction layer over structured, retrieved facts.

## Current market context

The concept is differentiated by being a **personal AI salary manager** rather than a generic tracker, but the category is competitive. The documents explicitly avoid claiming that AI budgeting itself is novel.

## Research date

External market/technical references verified September 11, 2026.
