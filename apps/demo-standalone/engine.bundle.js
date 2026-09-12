var SAIEngine = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // apps/demo-standalone/entry.ts
  var entry_exports = {};
  __export(entry_exports, {
    CurrencyMismatchError: () => CurrencyMismatchError,
    DEFAULT_CURRENCY_INFO: () => DEFAULT_CURRENCY_INFO,
    FINANCE_ENGINE_VERSION: () => FINANCE_ENGINE_VERSION,
    add: () => add,
    addPeriods: () => addPeriods,
    allocateByWeights: () => allocateByWeights,
    calculateEmergencyFundStatus: () => calculateEmergencyFundStatus,
    calculateMonthPlan: () => calculateMonthPlan,
    calculateSafeToSpend: () => calculateSafeToSpend,
    cmp: () => cmp,
    daysInMonth: () => daysInMonth,
    daysRemainingInPeriod: () => daysRemainingInPeriod,
    detectBudgetVariance: () => detectBudgetVariance,
    err: () => err,
    forecastRecurringCosts: () => forecastRecurringCosts,
    formatMoney: () => formatMoney,
    getCurrencyInfo: () => getCurrencyInfo,
    isKnownCurrency: () => isKnownCurrency,
    isNegative: () => isNegative,
    learnCategoryWeights: () => learnCategoryWeights,
    max: () => max,
    min: () => min,
    money: () => money,
    moneyFromMajor: () => moneyFromMajor,
    monthlyEquivalent: () => monthlyEquivalent,
    normalizeCurrencyCode: () => normalizeCurrencyCode,
    ok: () => ok,
    periodOf: () => periodOf,
    projectGoal: () => projectGoal,
    requiredMonthlyPaceMinor: () => requiredMonthlyPaceMinor,
    scaleFloor: () => scaleFloor,
    sub: () => sub,
    sum: () => sum,
    toMajor: () => toMajor,
    zero: () => zero
  });

  // packages/domain/src/currency.ts
  var CURRENCIES = {
    PKR: { code: "PKR", minorUnits: 2, symbol: "Rs" },
    USD: { code: "USD", minorUnits: 2, symbol: "$" },
    EUR: { code: "EUR", minorUnits: 2, symbol: "\u20AC" },
    GBP: { code: "GBP", minorUnits: 2, symbol: "\xA3" },
    INR: { code: "INR", minorUnits: 2, symbol: "\u20B9" },
    AED: { code: "AED", minorUnits: 2, symbol: "AED" },
    SAR: { code: "SAR", minorUnits: 2, symbol: "SAR" },
    JPY: { code: "JPY", minorUnits: 0, symbol: "\xA5" },
    KWD: { code: "KWD", minorUnits: 3, symbol: "KD" },
    BDT: { code: "BDT", minorUnits: 2, symbol: "Tk" },
    NGN: { code: "NGN", minorUnits: 2, symbol: "\u20A6" },
    ZAR: { code: "ZAR", minorUnits: 2, symbol: "R" },
    CAD: { code: "CAD", minorUnits: 2, symbol: "C$" },
    AUD: { code: "AUD", minorUnits: 2, symbol: "A$" },
    TRY: { code: "TRY", minorUnits: 2, symbol: "\u20BA" },
    BRL: { code: "BRL", minorUnits: 2, symbol: "R$" }
  };
  var DEFAULT_CURRENCY_INFO = {
    code: "XXX",
    minorUnits: 2,
    symbol: ""
  };
  function getCurrencyInfo(code) {
    return CURRENCIES[code] ?? { ...DEFAULT_CURRENCY_INFO, code };
  }
  function isKnownCurrency(code) {
    return Object.prototype.hasOwnProperty.call(CURRENCIES, code);
  }
  function normalizeCurrencyCode(input) {
    return input.trim().toUpperCase();
  }

  // packages/domain/src/money.ts
  var CurrencyMismatchError = class extends Error {
    constructor(a, b) {
      super(`Currency mismatch: ${a} vs ${b}`);
      this.name = "CurrencyMismatchError";
    }
  };
  function money(amountMinor, currency) {
    if (!Number.isSafeInteger(amountMinor)) {
      throw new RangeError(`Money must be a safe integer in minor units, got ${amountMinor}`);
    }
    return { amountMinor, currency };
  }
  function moneyFromMajor(major, currency) {
    const { minorUnits } = getCurrencyInfo(currency);
    const scaled = Math.round(major * 10 ** minorUnits);
    return money(scaled, currency);
  }
  function toMajor(m) {
    const { minorUnits } = getCurrencyInfo(m.currency);
    return m.amountMinor / 10 ** minorUnits;
  }
  function zero(currency) {
    return { amountMinor: 0, currency };
  }
  function assertSame(a, b) {
    if (a.currency !== b.currency) throw new CurrencyMismatchError(a.currency, b.currency);
  }
  function add(a, b) {
    assertSame(a, b);
    return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency };
  }
  function sub(a, b) {
    assertSame(a, b);
    return { amountMinor: a.amountMinor - b.amountMinor, currency: a.currency };
  }
  function isNegative(m) {
    return m.amountMinor < 0;
  }
  function cmp(a, b) {
    assertSame(a, b);
    return a.amountMinor < b.amountMinor ? -1 : a.amountMinor > b.amountMinor ? 1 : 0;
  }
  function min(a, b) {
    return cmp(a, b) <= 0 ? a : b;
  }
  function max(a, b) {
    return cmp(a, b) >= 0 ? a : b;
  }
  function sum(amounts, currency) {
    return amounts.reduce(
      (acc, m) => add(acc, m),
      zero(currency)
    );
  }
  function scaleFloor(m, num, den = 1) {
    if (den === 0) throw new RangeError("scale denominator must not be 0");
    return { amountMinor: Math.floor(m.amountMinor * num / den), currency: m.currency };
  }
  function allocateByWeights(total, weights) {
    const n = weights.length;
    if (n === 0) return [];
    if (weights.some((w) => w < 0 || !Number.isFinite(w))) {
      throw new RangeError("weights must be finite and non-negative");
    }
    const weightSum = weights.reduce((a, b) => a + b, 0);
    if (weightSum === 0) {
      return allocateByWeights(total, new Array(n).fill(1));
    }
    const exact = weights.map((w) => total.amountMinor * w / weightSum);
    const floors = exact.map((v) => Math.floor(v));
    let remainder = total.amountMinor - floors.reduce((a, b) => a + b, 0);
    const order = exact.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
    const result = floors.slice();
    for (const { i } of order) {
      if (remainder <= 0) break;
      result[i] += 1;
      remainder -= 1;
    }
    return result.map((amountMinor) => ({ amountMinor, currency: total.currency }));
  }
  function formatMoney(m) {
    const { symbol, minorUnits } = getCurrencyInfo(m.currency);
    const abs = Math.abs(m.amountMinor) / 10 ** minorUnits;
    const formatted = abs.toLocaleString("en-US", {
      minimumFractionDigits: minorUnits,
      maximumFractionDigits: minorUnits
    });
    const sign = m.amountMinor < 0 ? "-" : "";
    return `${sign}${symbol ? symbol + " " : ""}${formatted}`;
  }

  // packages/domain/src/plan.ts
  var FINANCE_ENGINE_VERSION = "1.0.0";

  // packages/domain/src/results.ts
  function ok(value) {
    return { ok: true, value };
  }
  function err(error) {
    return { ok: false, error };
  }

  // packages/finance-engine/src/period.ts
  function daysInMonth(period) {
    return new Date(Date.UTC(period.year, period.month, 0)).getUTCDate();
  }
  function parseISODate(date) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!m) throw new RangeError(`Invalid ISODate: ${date}`);
    return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  }
  function periodOf(date) {
    const { year, month } = parseISODate(date);
    return { year, month };
  }
  function daysRemainingInPeriod(today, period) {
    const p = parseISODate(today);
    if (p.year !== period.year || p.month !== period.month) return 0;
    return daysInMonth(period) - p.day + 1;
  }
  function addPeriods(p, months) {
    const total = p.year * 12 + (p.month - 1) + months;
    return { year: Math.floor(total / 12), month: total % 12 + 1 };
  }
  function monthsBetween(from, to) {
    return to.year * 12 + to.month - (from.year * 12 + from.month);
  }

  // apps/demo-standalone/sha256-shim.ts
  function createHash() {
    const K = new Uint32Array([
      1116352408,
      1899447441,
      3049323471,
      3921009573,
      961987163,
      1508970993,
      2453635748,
      2870763221,
      3624381080,
      310598401,
      607225278,
      1426881987,
      1925078388,
      2162078206,
      2614888103,
      3248222580,
      3835390401,
      4022224774,
      264347078,
      604807628,
      770255983,
      1249150122,
      1555081692,
      1996064986,
      2554220882,
      2821834349,
      2952996808,
      3210313671,
      3336571891,
      3584528711,
      113926993,
      338241895,
      666307205,
      773529912,
      1294757372,
      1396182291,
      1695183700,
      1986661051,
      2177026350,
      2456956037,
      2730485921,
      2820302411,
      3259730800,
      3345764771,
      3516065817,
      3600352804,
      4094571909,
      275423344,
      430227734,
      506948616,
      659060556,
      883997877,
      958139571,
      1322822218,
      1537002063,
      1747873779,
      1955562222,
      2024104815,
      2227730452,
      2361852424,
      2428436474,
      2756734187,
      3204031479,
      3329325298
    ]);
    let h = new Uint32Array([1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225]);
    let buffer = [];
    let length = 0;
    const rr = (x, n) => x >>> n | x << 32 - n;
    function processBlock(block) {
      const w = new Uint32Array(64);
      for (let i = 0; i < 16; i++) {
        w[i] = block[i * 4] << 24 | block[i * 4 + 1] << 16 | block[i * 4 + 2] << 8 | block[i * 4 + 3];
      }
      for (let i = 16; i < 64; i++) {
        const s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ w[i - 15] >>> 3;
        const s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ w[i - 2] >>> 10;
        w[i] = w[i - 16] + s0 + w[i - 7] + s1 | 0;
      }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25);
        const ch = e & f ^ ~e & g;
        const t1 = hh + S1 + ch + K[i] + w[i] | 0;
        const S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
        const maj = a & b ^ a & c ^ b & c;
        const t2 = S0 + maj | 0;
        hh = g;
        g = f;
        f = e;
        e = d + t1 | 0;
        d = c;
        c = b;
        b = a;
        a = t1 + t2 | 0;
      }
      h[0] = h[0] + a | 0;
      h[1] = h[1] + b | 0;
      h[2] = h[2] + c | 0;
      h[3] = h[3] + d | 0;
      h[4] = h[4] + e | 0;
      h[5] = h[5] + f | 0;
      h[6] = h[6] + g | 0;
      h[7] = h[7] + hh | 0;
    }
    return {
      update(data) {
        for (let i = 0; i < data.length; i++) {
          const code = data.charCodeAt(i);
          if (code < 128) buffer.push(code);
          else if (code < 2048) buffer.push(192 | code >> 6, 128 | code & 63);
          else buffer.push(224 | code >> 12, 128 | code >> 6 & 63, 128 | code & 63);
        }
        length += data.length;
        while (buffer.length >= 64) {
          processBlock(buffer.splice(0, 64));
        }
        return this;
      },
      digest() {
        const bitLen = length * 8;
        buffer.push(128);
        while (buffer.length % 64 !== 56) buffer.push(0);
        for (let i = 7; i >= 0; i--) buffer.push(bitLen / 2 ** (i * 8) & 255);
        for (let i = 0; i < buffer.length; i += 64) processBlock(buffer.slice(i, i + 64));
        return Array.from(h).map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
      }
    };
  }

  // packages/finance-engine/src/monthPlan.ts
  var DEFAULT_PLAN_POLICY = {
    variableIncomeHaircutPercent: 10,
    enforceLifestyleFloor: true,
    lifestyleFloorMinor: 0,
    // users raise this in preferences; the default stays world-neutral
    emergencyMaxPercentOfIncome: 30,
    goalFullyFundedToleranceMinor: 0
  };
  function sha256(value) {
    return createHash("sha256").update(value).digest("hex");
  }
  function monthlyEquivalent(amountMinor, cadence) {
    switch (cadence) {
      case "monthly":
        return amountMinor;
      case "weekly":
        return Math.floor(amountMinor * 52 / 12);
      case "annual":
        return Math.floor(amountMinor / 12);
    }
  }
  function requiredMonthlyPaceMinor(goal, period) {
    if (!goal.targetDate) return null;
    const [y, m] = goal.targetDate.split("-").map(Number);
    const monthsLeft = y * 12 + m - (period.year * 12 + period.month) + 1;
    if (monthsLeft <= 0) return goal.targetAmountMinor - goal.savedAmountMinor;
    return Math.ceil((goal.targetAmountMinor - goal.savedAmountMinor) / monthsLeft);
  }
  function calculateMonthPlan(input) {
    const policy = { ...DEFAULT_PLAN_POLICY, ...input.policy };
    const cur = input.currency;
    const warnings = [];
    let income = zero(cur);
    for (const src of input.incomeSources) {
      let amount = money(src.expectedAmountMinor, cur);
      if (src.reliability === "variable" && policy.variableIncomeHaircutPercent > 0) {
        amount = scaleFloor(amount, 100 - policy.variableIncomeHaircutPercent, 100);
        warnings.push({
          code: "variable_income_haircut_applied",
          message: `${src.name} is variable income; planning with a ${policy.variableIncomeHaircutPercent}% conservative haircut.`,
          refId: src.id
        });
      }
      income = add(income, amount);
    }
    const obligations = input.commitments.filter((c) => c.essential).map((c) => ({
      recurringItemId: c.id,
      name: c.name,
      amount: money(monthlyEquivalent(c.expectedAmountMinor, c.cadence), cur),
      dueDay: c.dueDay,
      protected: true
    }));
    let remaining = income;
    const protectedTotal = obligations.reduce((acc, o) => add(acc, o.amount), zero(cur));
    remaining = sub(remaining, protectedTotal);
    if (protectedTotal.amountMinor > income.amountMinor) {
      warnings.push({
        code: "income_below_essentials",
        message: "Expected income does not cover essential obligations. Review commitments or income."
      });
    }
    const bufferFull = policyBufferAmount(input.preferences, income, cur);
    const emergencyNeeded = max(
      zero(cur),
      money(input.emergency.targetAmountMinor - input.emergency.currentAmountMinor, cur)
    );
    const emergencyCap = scaleFloor(income, policy.emergencyMaxPercentOfIncome, 100);
    const flexCats = input.categories.filter((c) => c.kind === "flexible");
    const floorsSum = flexCats.reduce((acc, c) => acc + (c.floorMinor ?? 0), 0);
    const adjustable = [
      {
        kind: "buffer",
        name: "buffer",
        want: bufferFull,
        floorWanted: zero(cur),
        priority: input.preferences.bufferBeforeGoals ? 0 : 90
      },
      {
        kind: "emergency",
        name: "emergency fund",
        want: min(emergencyNeeded, emergencyCap),
        floorWanted: zero(cur),
        priority: 10
      }
    ];
    if (floorsSum > 0) {
      adjustable.push({
        kind: "flexfloor",
        name: "category minimums",
        want: money(floorsSum, cur),
        floorWanted: money(floorsSum, cur),
        priority: 15
      });
    }
    const activeGoals = input.goals.filter((g) => g.status === "active").sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
    activeGoals.forEach((g, idx) => {
      const remainingToTarget = max(zero(cur), money(g.targetAmountMinor - g.savedAmountMinor, cur));
      const pace = requiredMonthlyPaceMinor(g, input.period);
      const floor = g.minMonthlyContributionMinor ? min(money(g.minMonthlyContributionMinor, cur), remainingToTarget) : zero(cur);
      adjustable.push({
        kind: "goal",
        name: g.name,
        want: min(remainingToTarget, max(floor, pace != null ? money(pace, cur) : zero(cur))),
        floorWanted: floor,
        refId: g.id,
        priority: 20 + idx
      });
    });
    const funded = /* @__PURE__ */ new Map();
    const keyOf = (a) => a.kind === "goal" ? `goal:${a.refId}` : a.kind;
    for (const item of [...adjustable].sort(
      (a, b) => floorRank(a) - floorRank(b) || a.priority - b.priority
    )) {
      if (item.floorWanted.amountMinor <= 0) continue;
      const give = min(item.floorWanted, max(zero(cur), remaining));
      if (give.amountMinor <= 0) continue;
      funded.set(keyOf(item), give.amountMinor);
      remaining = sub(remaining, give);
    }
    for (const item of [...adjustable].sort((a, b) => a.priority - b.priority)) {
      const already = funded.get(keyOf(item)) ?? 0;
      const wantLeft = item.want.amountMinor - already;
      if (wantLeft <= 0) continue;
      const give = Math.min(wantLeft, Math.max(0, remaining.amountMinor));
      if (give <= 0) continue;
      funded.set(keyOf(item), already + give);
      remaining = sub(remaining, money(give, cur));
    }
    for (const item of adjustable) {
      const got = funded.get(keyOf(item)) ?? 0;
      if (item.kind === "goal" && got < item.want.amountMinor) {
        warnings.push({
          code: "goal_underfunded",
          message: `Goal "${item.name}" cannot receive its full planned contribution this month.`,
          refId: item.refId
        });
      } else if (item.kind === "emergency" && got < item.want.amountMinor) {
        warnings.push({
          code: "emergency_contribution_capped",
          message: "Emergency fund contribution was reduced to keep the plan feasible."
        });
      } else if (item.kind === "buffer" && got < item.want.amountMinor) {
        warnings.push({
          code: "insufficient_for_buffer",
          message: "Buffer was reduced; consider trimming flexible categories."
        });
      }
    }
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
            message: "Income does not cover essentials plus the minimum lifestyle amount. Essentials remain protected; review your plan."
          });
        }
      }
    }
    const buffer = money(funded.get("buffer") ?? 0, cur);
    const emergencyContribution = money(funded.get("emergency") ?? 0, cur);
    const flexfloorFunded = money(funded.get("flexfloor") ?? 0, cur);
    const goalAllocations = activeGoals.map((g) => {
      const planned = money(funded.get(`goal:${g.id}`) ?? 0, cur);
      return {
        goalId: g.id,
        name: g.name,
        priority: g.priority,
        planned,
        requiredMonthlyPaceMinor: requiredMonthlyPaceMinor(g, input.period) ?? void 0,
        fullyFunded: g.savedAmountMinor + planned.amountMinor >= g.targetAmountMinor - policy.goalFullyFundedToleranceMinor
      };
    });
    const flexibleCategories = [];
    let flexibleTotal = zero(cur);
    if (flexCats.length > 0) {
      const preFunded = /* @__PURE__ */ new Map();
      if (flexfloorFunded.amountMinor > 0) {
        const floorSplit = allocateByWeights(
          flexfloorFunded,
          flexCats.map((c) => c.floorMinor ?? 0)
        );
        flexCats.forEach((c, i) => preFunded.set(c.id, floorSplit[i]?.amountMinor ?? 0));
      }
      const residual = allocateByWeights(
        max(zero(cur), remaining),
        flexCats.map((c) => c.baselineWeight)
      );
      flexCats.forEach((c, i) => {
        const plannedMinor = (preFunded.get(c.id) ?? 0) + (residual[i]?.amountMinor ?? 0);
        flexibleCategories.push({
          categoryId: c.id,
          name: c.name,
          planned: money(plannedMinor, cur),
          weight: c.baselineWeight
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
      add(add(emergencyContribution, goalsTotal), buffer)
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
        policy
      })
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
        buffer
      },
      totals: {
        income,
        protected: protectedTotal,
        flexible: flexibleTotal,
        emergency: emergencyContribution,
        goals: goalsTotal,
        buffer,
        unallocated
      },
      warnings,
      calculationVersion: FINANCE_ENGINE_VERSION,
      inputsHash,
      createdAt: input.createdAt
    };
  }
  function floorRank(a) {
    return a.floorWanted.amountMinor > 0 ? 0 : 1;
  }
  function policyBufferAmount(prefs, income, cur) {
    if (prefs.buffer.kind === "fixed") return money(Math.max(0, Math.floor(prefs.buffer.value)), cur);
    const pct = Math.min(100, Math.max(0, prefs.buffer.value));
    return scaleFloor(income, Math.round(pct * 100), 1e4);
  }

  // packages/finance-engine/src/safeToSpend.ts
  function calculateSafeToSpend(input) {
    const cur = input.currency;
    const flexBudgetTotal = input.flexibleBudget.reduce(
      (acc, b) => acc + Math.max(0, b.plannedMinor),
      0
    );
    const inPeriod = input.transactions.filter((t) => samePeriod(t.date, input.period));
    const flexibleCategoryIds = new Set(input.flexibleBudget.map((b) => b.categoryId));
    const flexibleSpent = inPeriod.filter((t) => t.categoryId != null && flexibleCategoryIds.has(t.categoryId)).reduce((acc, t) => acc + Math.abs(t.amount.amountMinor), 0);
    const flexibleRemaining = flexBudgetTotal - flexibleSpent;
    const reserved = input.upcomingObligations.reduce((acc, o) => acc + Math.max(0, o.amountMinor), 0);
    const overspend = max(zero(cur), money(-flexibleRemaining, cur));
    const availableNow = max(zero(cur), money(Math.min(flexibleRemaining, flexibleRemaining - reserved), cur));
    const daysRemaining = Math.max(1, daysRemainingInPeriod(input.today, input.period));
    const dailyRecommended = scaleFloor(availableNow, 1, daysRemaining);
    const breakdown = {
      flexibleBudgetTotal: money(flexBudgetTotal, cur),
      flexibleSpent: money(flexibleSpent, cur),
      flexibleRemaining: money(Math.max(0, flexibleRemaining), cur),
      reservedForUpcomingObligations: money(reserved, cur),
      overspend
    };
    return {
      asOf: input.today,
      period: input.period,
      currency: cur,
      availableNow,
      dailyRecommended,
      daysRemaining: daysRemainingInPeriod(input.today, input.period),
      breakdown,
      calculationVersion: FINANCE_ENGINE_VERSION
    };
  }
  function samePeriod(date, period) {
    const p = periodOf(date);
    return p.year === period.year && p.month === period.month;
  }

  // packages/finance-engine/src/variance.ts
  var DEFAULT_VARIANCE_POLICY = {
    atRiskThresholdPercent: 85,
    overThresholdPercent: 100,
    underThresholdPercent: 50
  };
  function detectBudgetVariance(input) {
    const policy = { ...DEFAULT_VARIANCE_POLICY, ...input.policy };
    const cur = input.currency;
    const actualByCategory = /* @__PURE__ */ new Map();
    for (const t of input.transactions) {
      if (!t.categoryId) continue;
      const p = periodOf(t.date);
      if (p.year !== input.period.year || p.month !== input.period.month) continue;
      actualByCategory.set(t.categoryId, (actualByCategory.get(t.categoryId) ?? 0) + Math.abs(t.amount.amountMinor));
    }
    const lines = input.planned.map((row) => {
      const planned = money(Math.max(0, row.plannedMinor), cur);
      const actual = money(actualByCategory.get(row.categoryId) ?? 0, cur);
      const percentUsed = planned.amountMinor === 0 ? actual.amountMinor > 0 ? Number.POSITIVE_INFINITY : 0 : actual.amountMinor / planned.amountMinor * 100;
      const status = percentUsed > policy.overThresholdPercent ? "over" : percentUsed > policy.atRiskThresholdPercent ? "at_risk" : percentUsed < policy.underThresholdPercent ? "under" : "on_track";
      return {
        categoryId: row.categoryId,
        name: row.name,
        planned,
        actual,
        delta: sub(planned, actual),
        percentUsed: Number.isFinite(percentUsed) ? Math.round(percentUsed * 10) / 10 : percentUsed,
        status
      };
    });
    const totalPlanned = input.planned.reduce(
      (acc, r) => acc = addMinor(acc, Math.max(0, r.plannedMinor)),
      0
    );
    const totalActual = lines.reduce((acc, l) => acc + l.actual.amountMinor, 0);
    return {
      period: input.period,
      currency: cur,
      lines,
      totalPlanned: money(totalPlanned, cur),
      totalActual: money(totalActual, cur),
      calculationVersion: FINANCE_ENGINE_VERSION
    };
  }
  function addMinor(acc, minor) {
    return acc + minor;
  }

  // packages/finance-engine/src/emergencyFund.ts
  function calculateEmergencyFundStatus(input) {
    const cur = input.currency;
    const current = money(input.currentAmountMinor, cur);
    const target = money(Math.max(0, input.targetAmountMinor), cur);
    const progressPercent = target.amountMinor === 0 ? 0 : Math.min(100, current.amountMinor / target.amountMinor * 100);
    const essentials = Math.max(1, input.averageMonthlyEssentialsMinor);
    return {
      currency: cur,
      current,
      target,
      progressPercent: Math.round(progressPercent * 10) / 10,
      essentialsCoverageMonths: Math.round(current.amountMinor / essentials * 10) / 10,
      monthlyContribution: money(Math.max(0, input.monthlyContributionMinor), cur),
      calculationVersion: FINANCE_ENGINE_VERSION
    };
  }

  // packages/finance-engine/src/goalProjection.ts
  function projectGoal(input) {
    const remaining = Math.max(0, input.goal.targetAmountMinor - input.goal.savedAmountMinor);
    const hasDeadline = input.goal.targetDate != null;
    const [y, m] = (input.goal.targetDate ?? "").split("-").map(Number);
    const deadlinePeriod = hasDeadline ? { year: y, month: m ?? 1 } : void 0;
    const monthsRemaining = deadlinePeriod ? Math.max(0, monthsBetween(input.period, deadlinePeriod) + 1) : Number.POSITIVE_INFINITY;
    const requiredMonthlyPaceMinor2 = deadlinePeriod ? monthsRemaining <= 0 ? remaining : Math.ceil(remaining / monthsRemaining) : 0;
    let projectedCompletion;
    if (remaining === 0) {
      projectedCompletion = input.period;
    } else if (input.plannedMonthlyContributionMinor > 0) {
      const monthsNeeded = Math.ceil(remaining / input.plannedMonthlyContributionMinor);
      projectedCompletion = addPeriods(input.period, monthsNeeded - 1);
    }
    const onTrack = remaining === 0 ? true : !deadlinePeriod ? input.plannedMonthlyContributionMinor > 0 : input.plannedMonthlyContributionMinor >= requiredMonthlyPaceMinor2;
    return {
      goalId: input.goal.id,
      requiredMonthlyPaceMinor: requiredMonthlyPaceMinor2,
      monthsRemaining: deadlinePeriod ? monthsRemaining : null,
      projectedCompletion,
      onTrack,
      calculationVersion: FINANCE_ENGINE_VERSION
    };
  }

  // packages/finance-engine/src/recurringForecast.ts
  function toMonthlyMinor(amountMinor, cadence) {
    switch (cadence) {
      case "monthly":
        return amountMinor;
      case "weekly":
        return Math.floor(amountMinor * 52 / 12);
      case "annual":
        return Math.floor(amountMinor / 12);
    }
  }
  function forecastRecurringCosts(items, period, currency) {
    const lines = items.map((item) => {
      const expected = toMonthlyMinor(item.expectedAmountMinor, item.cadence);
      const low = item.rangeMinor ? toMonthlyMinor(item.rangeMinor.low, item.cadence) : expected;
      const high = item.rangeMinor ? toMonthlyMinor(item.rangeMinor.high, item.cadence) : expected;
      return {
        recurringItemId: item.id,
        name: item.name,
        expected: money(expected, currency),
        range: {
          low: money(Math.min(low, expected), currency),
          high: money(Math.max(high, expected), currency)
        },
        dueDay: item.dueDay,
        confidence: item.confidence
      };
    });
    const totalExpected = lines.reduce((acc, l) => acc + l.expected.amountMinor, 0);
    const totalLow = lines.reduce((acc, l) => acc + l.range.low.amountMinor, 0);
    const totalHigh = lines.reduce((acc, l) => acc + l.range.high.amountMinor, 0);
    return {
      period,
      currency,
      lines,
      totalExpected: money(totalExpected, currency),
      totalRange: { low: money(totalLow, currency), high: money(totalHigh, currency) },
      calculationVersion: FINANCE_ENGINE_VERSION
    };
  }

  // packages/finance-engine/src/learning.ts
  var DEFAULT_LEARNING_POLICY = {
    damping: 0.3,
    minWeightFractionOfMean: 0.25,
    minTransactions: 4,
    materialChangePercent: 0.25
  };
  function round2(n) {
    return Math.round(n * 100) / 100;
  }
  function learnCategoryWeights(input) {
    const policy = { ...DEFAULT_LEARNING_POLICY, ...input.policy };
    const inPeriod = input.transactions.filter((t) => {
      const p = periodOf(t.date);
      return p.year === input.period.year && p.month === input.period.month;
    });
    const actualByCategory = /* @__PURE__ */ new Map();
    let observedTotal = 0;
    let categorized = 0;
    for (const t of inPeriod) {
      if (!t.categoryId) continue;
      if (!input.categories.some((c) => c.id === t.categoryId)) continue;
      const spend = Math.abs(t.amount.amountMinor);
      actualByCategory.set(t.categoryId, (actualByCategory.get(t.categoryId) ?? 0) + spend);
      observedTotal += spend;
      categorized += 1;
    }
    const evidence = {
      transactionsInPeriod: inPeriod.length,
      categorizedInPeriod: categorized,
      observedFlexibleMinor: observedTotal,
      sufficient: categorized >= policy.minTransactions && observedTotal > 0
    };
    const weights = {};
    const changes = [];
    if (!evidence.sufficient || input.categories.length === 0) {
      return { weights, changes, evidence };
    }
    const oldSum = input.categories.reduce((a, c) => a + c.baselineWeight, 0);
    const meanOld = oldSum / input.categories.length;
    const floor = policy.minWeightFractionOfMean * meanOld;
    const plannedTotal = input.plannedMinor.reduce((a, p) => a + Math.max(0, p.plannedMinor), 0);
    for (const c of input.categories) {
      const old = c.baselineWeight;
      const oldShare = oldSum > 0 ? old / oldSum : 1 / input.categories.length;
      const observedShare = observedTotal > 0 ? (actualByCategory.get(c.id) ?? 0) / observedTotal : 0;
      const blendedShare = (1 - policy.damping) * oldShare + policy.damping * observedShare;
      let next = Math.max(floor, round2(blendedShare * oldSum));
      const plannedShare = plannedTotal > 0 ? (input.plannedMinor.find((p) => p.categoryId === c.id)?.plannedMinor ?? 0) / plannedTotal : oldShare;
      const observedPercent = Math.round(observedShare * 100);
      const plannedPercent = Math.round(plannedShare * 100);
      if (next !== old) {
        const relativeChange = old > 0 ? Math.abs(next - old) / old : 1;
        const direction = next > old ? "up" : "down";
        changes.push({
          categoryId: c.id,
          name: c.name,
          fromWeight: old,
          toWeight: next,
          reason: `Observed ${observedPercent}% of flexible spend vs ${plannedPercent}% planned share \u2014 weight adjusted ${direction} from ${old} to ${next}.`,
          material: relativeChange >= policy.materialChangePercent
        });
        weights[c.id] = next;
      }
    }
    return { weights, changes, evidence };
  }
  return __toCommonJS(entry_exports);
})();
