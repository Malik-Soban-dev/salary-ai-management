/**
 * calculateMonthPlan — the deterministic salary allocator.
 *
 * Allocation order (01_PRD product rule 1: "Essential obligations are protected
 * before flexible spending suggestions"):
 *
 *   1. Income (with a documented haircut for variable income)
 *   2. Essential obligations   — protected, never reduced by the planner
 *   3. Floors pass:            category minimums + goal minimum contributions
 *   4. Wants pass, by priority: emergency top-up → goals (required pace) → buffer
 *   5. Flexible spending = remainder, split across categories by weights,
 *      with floored categories guaranteed their minimum
 *
 * If money runs short, wants unwind in reverse priority (buffer first, then
 * lowest-priority goals, then emergency). Floors and essential obligations are
 * never negative; shortfalls surface as structured warnings instead.
 *
 * Every output embeds FINANCE_ENGINE_VERSION and a hash of the exact inputs so
 * any number in the UI can be reproduced from stored facts (01_PRD rule 4).
 */
import {
  FINANCE_ENGINE_VERSION,
  add,
  allocateByWeights,
  createHash,
  max,
  min,
  money,
  scaleFloor,
  sub,
  zero,
  type CategoryAllocation,
  type CurrencyCode,
  type FinancialPreferences,
  type Goal,
  type GoalAllocation,
  type IncomeSource,
  type Money,
  type MonthlyPlan,
  type ObligationAllocation,
  type PlanPeriod,
  type PlanWarning,
  type RecurringItem,
  type SpendingCategory,
} from "./deps.js";
import { daysInMonth } from "./period.js";

export interface PlanPolicy {
  /** % haircut applied to variable (non-salary) income for conservatism. 0–100. */
  variableIncomeHaircutPercent: number;
  /** If true, a minimum flexible budget is enforced before future money. */
  enforceLifestyleFloor: boolean;
  /** Absolute minimum flexible spending per month (minor units). */
  lifestyleFloorMinor: number;
  /** Emergency contributions beyond this % of income are capped per month. */
  emergencyMaxPercentOfIncome: number;
  /** Rounding tolerance when deciding whether a goal is fully funded. */
  goalFullyFundedToleranceMinor: number;
}

export const DEFAULT_PLAN_POLICY: PlanPolicy = {
  variableIncomeHaircutPercent: 10,
  enforceLifestyleFloor: true,
  lifestyleFloorMinor: 0, // users raise this in preferences; the default stays world-neutral
  emergencyMaxPercentOfIncome: 30,
  goalFullyFundedToleranceMinor: 0,
};

export interface MonthPlanInput {
  period: PlanPeriod;
  currency: CurrencyCode;
  incomeSources: readonly IncomeSource[];
  commitments: readonly RecurringItem[];
  categories: readonly SpendingCategory[];
  emergency: { currentAmountMinor: number; targetAmountMinor: number };
  preferences: FinancialPreferences;
  goals: readonly Goal[];
  policy?: Partial<PlanPolicy>;
  planId: string;
  userId: string;
  createdAt: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Monthly-equivalent amount of a commitment, in minor units (deterministic). */
export function monthlyEquivalent(amountMinor: number, cadence: RecurringItem["cadence"]): number {
  switch (cadence) {
    case "monthly":
      return amountMinor;
    case "weekly":
      return Math.floor((amountMinor * 52) / 12);
    case "annual":
      return Math.floor(amountMinor / 12);
  }
}

/** Required monthly pace (minor units/month) to reach the goal by its deadline; null when open-ended. */
export function requiredMonthlyPaceMinor(goal: Goal, period: PlanPeriod): number | null {
  if (!goal.targetDate) return null;
  const [y, m] = goal.targetDate.split("-").map(Number) as [number, number];
  const monthsLeft = y * 12 + m - (period.year * 12 + period.month) + 1;
  if (monthsLeft <= 0) return goal.targetAmountMinor - goal.savedAmountMinor;
  return Math.ceil((goal.targetAmountMinor - goal.savedAmountMinor) / monthsLeft);
}

interface Adjustable {
  kind: "buffer" | "emergency" | "goal" | "flexfloor";
  name: string;
  want: Money;
  floorWanted: Money;
  refId?: string;
  priority: number;
}

export function calculateMonthPlan(input: MonthPlanInput): MonthlyPlan {
  const policy: PlanPolicy = { ...DEFAULT_PLAN_POLICY, ...input.policy };
  const cur = input.currency;
  const warnings: PlanWarning[] = [];

  // ---- 1. Income ----------------------------------------------------------
  let income = zero(cur);
  for (const src of input.incomeSources) {
    let amount = money(src.expectedAmountMinor, cur);
    if (src.reliability === "variable" && policy.variableIncomeHaircutPercent > 0) {
      amount = scaleFloor(amount, 100 - policy.variableIncomeHaircutPercent, 100);
      warnings.push({
        code: "variable_income_haircut_applied",
        message: `${src.name} is variable income; planning with a ${policy.variableIncomeHaircutPercent}% conservative haircut.`,
        refId: src.id,
      });
    }
    income = add(income, amount);
  }

  // ---- 2. Essential obligations (protected) -------------------------------
  const obligations: ObligationAllocation[] = input.commitments
    .filter((c) => c.essential)
    .map((c) => ({
      recurringItemId: c.id,
      name: c.name,
      amount: money(monthlyEquivalent(c.expectedAmountMinor, c.cadence), cur),
      dueDay: c.dueDay,
      protected: true,
    }));
  let remaining = income;
  const protectedTotal = obligations.reduce((acc, o) => add(acc, o.amount), zero(cur));
  remaining = sub(remaining, protectedTotal);
  if (protectedTotal.amountMinor > income.amountMinor) {
    warnings.push({
      code: "income_below_essentials",
      message: "Expected income does not cover essential obligations. Review commitments or income.",
    });
  }

  // ---- 3. Adjustable future money -----------------------------------------
  const bufferFull = policyBufferAmount(input.preferences, income, cur);
  const emergencyNeeded = max(
    zero(cur),
    money(input.emergency.targetAmountMinor - input.emergency.currentAmountMinor, cur),
  );
  const emergencyCap = scaleFloor(income, policy.emergencyMaxPercentOfIncome, 100);

  const flexCats = input.categories.filter((c) => c.kind === "flexible");
  const floorsSum = flexCats.reduce((acc, c) => acc + (c.floorMinor ?? 0), 0);

  const adjustable: Adjustable[] = [
    {
      kind: "buffer",
      name: "buffer",
      want: bufferFull,
      floorWanted: zero(cur),
      priority: input.preferences.bufferBeforeGoals ? 0 : 90,
    },
    {
      kind: "emergency",
      name: "emergency fund",
      want: min(emergencyNeeded, emergencyCap),
      floorWanted: zero(cur),
      priority: 10,
    },
  ];
  if (floorsSum > 0) {
    adjustable.push({
      kind: "flexfloor",
      name: "category minimums",
      want: money(floorsSum, cur),
      floorWanted: money(floorsSum, cur),
      priority: 15,
    });
  }

  const activeGoals = input.goals
    .filter((g) => g.status === "active")
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  activeGoals.forEach((g, idx) => {
    const remainingToTarget = max(zero(cur), money(g.targetAmountMinor - g.savedAmountMinor, cur));
    const pace = requiredMonthlyPaceMinor(g, input.period);
    const floor = g.minMonthlyContributionMinor
      ? min(money(g.minMonthlyContributionMinor, cur), remainingToTarget)
      : zero(cur);
    adjustable.push({
      kind: "goal",
      name: g.name,
      want: min(remainingToTarget, max(floor, pace != null ? money(pace, cur) : zero(cur))),
      floorWanted: floor,
      refId: g.id,
      priority: 20 + idx,
    });
  });

  const funded = new Map<string, number>();
  const keyOf = (a: Adjustable) => (a.kind === "goal" ? `goal:${a.refId}` : a.kind);

  // Pass A — floors first (category minimums, goal minimums), priority order.
  for (const item of [...adjustable].sort(
    (a, b) => floorRank(a) - floorRank(b) || a.priority - b.priority,
  )) {
    if (item.floorWanted.amountMinor <= 0) continue;
    const give = min(item.floorWanted, max(zero(cur), remaining));
    if (give.amountMinor <= 0) continue;
    funded.set(keyOf(item), give.amountMinor);
    remaining = sub(remaining, give);
  }

  // Pass B — fill wants up to full amounts in priority order.
  for (const item of [...adjustable].sort((a, b) => a.priority - b.priority)) {
    const already = funded.get(keyOf(item)) ?? 0;
    const wantLeft = item.want.amountMinor - already;
    if (wantLeft <= 0) continue;
    const give = Math.min(wantLeft, Math.max(0, remaining.amountMinor));
    if (give <= 0) continue;
    funded.set(keyOf(item), already + give);
    remaining = sub(remaining, money(give, cur));
  }

  // Structured warnings for anything underfunded.
  for (const item of adjustable) {
    const got = funded.get(keyOf(item)) ?? 0;
    if (item.kind === "goal" && got < item.want.amountMinor) {
      warnings.push({
        code: "goal_underfunded",
        message: `Goal "${item.name}" cannot receive its full planned contribution this month.`,
        refId: item.refId,
      });
    } else if (item.kind === "emergency" && got < item.want.amountMinor) {
      warnings.push({
        code: "emergency_contribution_capped",
        message: "Emergency fund contribution was reduced to keep the plan feasible.",
      });
    } else if (item.kind === "buffer" && got < item.want.amountMinor) {
      warnings.push({
        code: "insufficient_for_buffer",
        message: "Buffer was reduced; consider trimming flexible categories.",
      });
    }
  }

  // ---- 4. Lifestyle floor unwind ------------------------------------------
  // If flexible money would fall below the configured floor, unwind future money
  // in reverse priority (least important first) down to each item's floor.
  if (policy.enforceLifestyleFloor && policy.lifestyleFloorMinor > 0) {
    let deficit = policy.lifestyleFloorMinor - Math.max(0, remaining.amountMinor);
    if (deficit > 0) {
      for (const item of [...adjustable].sort((a, b) => b.priority - a.priority)) {
        if (deficit <= 0) break;
        const got = funded.get(keyOf(item)) ?? 0;
        const reclaimable = got - item.floorWanted.amountMinor;
        if (reclaimable <= 0) continue;
        const take = Math.min(reclaimable, deficit);
        funded.set(keyOf(item), got - take);
        deficit -= take;
        remaining = add(remaining, money(take, cur));
      }
      if (deficit > 0) {
        warnings.push({
          code: "income_below_minimum_lifestyle",
          message:
            "Income does not cover essentials plus the minimum lifestyle amount. Essentials remain protected; review your plan.",
        });
      }
    }
  }

  const buffer = money(funded.get("buffer") ?? 0, cur);
  const emergencyContribution = money(funded.get("emergency") ?? 0, cur);
  const flexfloorFunded = money(funded.get("flexfloor") ?? 0, cur);

  const goalAllocations: GoalAllocation[] = activeGoals.map((g) => {
    const planned = money(funded.get(`goal:${g.id}`) ?? 0, cur);
    return {
      goalId: g.id,
      name: g.name,
      priority: g.priority,
      planned,
      requiredMonthlyPaceMinor: requiredMonthlyPaceMinor(g, input.period) ?? undefined,
      fullyFunded:
        g.savedAmountMinor + planned.amountMinor >=
        g.targetAmountMinor - policy.goalFullyFundedToleranceMinor,
    };
  });

  // ---- 5. Flexible spending split -----------------------------------------
  // Categories with floors were pre-funded (flexfloor); they receive their floor
  // plus a proportional share of the residual, so the split stays sum-preserving.
  const flexibleCategories: CategoryAllocation[] = [];
  let flexibleTotal = zero(cur);
  if (flexCats.length > 0) {
    const preFunded = new Map<string, number>();
    if (flexfloorFunded.amountMinor > 0) {
      const floorSplit = allocateByWeights(
        flexfloorFunded,
        flexCats.map((c) => c.floorMinor ?? 0),
      );
      flexCats.forEach((c, i) => preFunded.set(c.id, floorSplit[i]?.amountMinor ?? 0));
    }
    const residual = allocateByWeights(
      max(zero(cur), remaining),
      flexCats.map((c) => c.baselineWeight),
    );
    flexCats.forEach((c, i) => {
      const plannedMinor = (preFunded.get(c.id) ?? 0) + (residual[i]?.amountMinor ?? 0);
      flexibleCategories.push({
        categoryId: c.id,
        name: c.name,
        planned: money(plannedMinor, cur),
        weight: c.baselineWeight,
      });
    });
    flexibleTotal = flexibleCategories.reduce((acc, a) => add(acc, a.planned), zero(cur));
  }
  remaining = sub(max(zero(cur), remaining), zero(cur));
  const afterFlex = sub(max(zero(cur), remaining), flexibleTotal);
  const unallocatedAfterFlex = max(zero(cur), afterFlex);

  const goalsTotal = goalAllocations.reduce((acc, g) => add(acc, g.planned), zero(cur));
  const allocated = add(
    add(protectedTotal, flexibleTotal),
    add(add(emergencyContribution, goalsTotal), buffer),
  );
  const unallocated = max(zero(cur), sub(income, allocated));
  void unallocatedAfterFlex;

  const inputsHash = sha256(
    JSON.stringify({
      period: input.period,
      currency: cur,
      incomeSources: input.incomeSources,
      commitments: input.commitments,
      categories: input.categories,
      emergency: input.emergency,
      preferences: input.preferences,
      goals: input.goals,
      policy,
    }),
  );

  return {
    id: input.planId,
    userId: input.userId,
    period: input.period,
    currency: cur,
    status: "draft",
    allocations: {
      obligations,
      flexible: flexibleCategories,
      emergency: emergencyContribution,
      goals: goalAllocations,
      buffer,
    },
    totals: {
      income,
      protected: protectedTotal,
      flexible: flexibleTotal,
      emergency: emergencyContribution,
      goals: goalsTotal,
      buffer,
      unallocated,
    },
    warnings,
    calculationVersion: FINANCE_ENGINE_VERSION,
    inputsHash,
    createdAt: input.createdAt,
  };
}

function floorRank(a: Adjustable): number {
  return a.floorWanted.amountMinor > 0 ? 0 : 1;
}

function policyBufferAmount(prefs: FinancialPreferences, income: Money, cur: CurrencyCode): Money {
  if (prefs.buffer.kind === "fixed") return money(Math.max(0, Math.floor(prefs.buffer.value)), cur);
  const pct = Math.min(100, Math.max(0, prefs.buffer.value));
  return scaleFloor(income, Math.round(pct * 100), 10000);
}

export { daysInMonth };
