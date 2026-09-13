# Agent Guide — salary-ai-management

## UI/UX Skill (always use for interface work)

This repo has the **ui-ux-pro-max** design-intelligence skill installed at
`.claude/skills/ui-ux-pro-max/`.

**Rule:** before designing, building, reviewing or fixing ANY interface
(pages, components, design systems, color, typography, layout, motion,
accessibility, charts), query the skill first and base decisions on its output.

```bash
# Whole-product / new page visual direction
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "payroll dashboard fintech" --design-system

# Targeted concern
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "data table empty state" --domain ux
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "finance app palette" --domain color
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "dashboard font pairing" --domain typography
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "salary trend over time" --domain chart

# Stack-specific implementation guidance
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "form validation" --stack nextjs
```

Domains: `ux`, `style`, `product`, `color`, `typography`, `icons`, `gsap`, `chart`, `stack`.

Priority order when reviewing UI: accessibility → touch/interaction → performance →
style consistency → responsive layout → typography/color → animation → forms →
navigation → charts. Full rules: `.claude/skills/ui-ux-pro-max/references/quick-reference.md`
and `references/pro-rules.md`.

Skip the skill only for pure backend/API/infra work with no visual impact.

Source: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill (MIT)
