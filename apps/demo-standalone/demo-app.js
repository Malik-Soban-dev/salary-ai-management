/* Salary AI standalone demo — runs the REAL finance engine (window.SAIEngine) fully in-browser. */
(function () {
  "use strict";
  const S = window.SAIEngine;
  const KEY = "sai-demo-v1";
  const state = { account: null, view: "home", draft: null, chat: [] };

  // ---------- utils ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const SYM = { PKR: "Rs", USD: "$", EUR: "€", GBP: "£", INR: "₹", AED: "AED", SAR: "SAR", JPY: "¥", CAD: "C$", AUD: "A$" };
  const DIG = { JPY: 0 };
  const digits = (cur) => (DIG[cur] != null ? DIG[cur] : 2);
  function fmt(minor, cur) {
    cur = cur || (state.account && state.account.currency) || "USD";
    const n = (Math.abs(minor) / 10 ** digits(cur)).toLocaleString("en-US", { minimumFractionDigits: digits(cur), maximumFractionDigits: digits(cur) });
    return (minor < 0 ? "−" : "") + (SYM[cur] || cur) + " " + n;
  }
  const toMinor = (major, cur) => Math.round(major * 10 ** digits(cur));
  function todayISO(offset) {
    const d = new Date();
    d.setDate(d.getDate() + (offset || 0));
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  const currentPeriod = () => S.periodOf(todayISO());
  function monthName(p) { return new Date(p.year, p.month - 1, 1).toLocaleString("en", { month: "long", year: "numeric" }); }
  const uid = () => Math.random().toString(36).slice(2, 12);
  const samePeriod = (a, b) => a.year === b.year && a.month === b.month;
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state.account)); } catch (e) {} }

  // ---------- seeded account (engine-shaped, minor units) ----------
  function freshAccount() {
    const cur = "PKR";
    const ym = todayISO().slice(0, 8);
    const today = Number(todayISO().slice(8, 10));
    const tx = (day, amount, merchant, categoryId, source) => ({
      id: uid(), userId: "demo",
      amount: { amountMinor: toMinor(amount, cur), currency: cur },
      date: ym + String(Math.max(1, Math.min(today, day))).padStart(2, "0"),
      merchant, categoryId, source, confidence: source === "text" ? 0.8 : 1,
      createdAt: new Date().toISOString(),
    });
    const acct = {
      currency: cur,
      locale: { countryCode: "PK", language: "en", timezone: (Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"), weekStart: 1 },
      createdAt: new Date().toISOString(),
      subscription: { status: "trialing" },
      incomeSources: [
        { id: uid(), name: "Salary (take-home)", expectedAmountMinor: toMinor(185000, cur), currency: cur, frequency: "monthly", paydayRule: { kind: "day_of_month", day: 1 }, reliability: "stable" },
        { id: uid(), name: "Freelance design", expectedAmountMinor: toMinor(25000, cur), currency: cur, frequency: "monthly", paydayRule: { kind: "day_of_month", day: 20 }, reliability: "variable" },
      ],
      commitments: [
        { id: uid(), name: "Rent", essential: true, expectedAmountMinor: toMinor(45000, cur), cadence: "monthly", dueDay: 5, confidence: 1, source: "user" },
        { id: uid(), name: "Utilities", essential: true, expectedAmountMinor: toMinor(14000, cur), rangeMinor: { low: toMinor(11000, cur), high: toMinor(18000, cur) }, cadence: "monthly", dueDay: 15, confidence: 1, source: "user" },
        { id: uid(), name: "Internet + phone", essential: true, expectedAmountMinor: toMinor(3500, cur), cadence: "monthly", dueDay: 12, confidence: 1, source: "user" },
        { id: uid(), name: "Family support", essential: true, expectedAmountMinor: toMinor(25000, cur), cadence: "monthly", dueDay: 3, confidence: 1, source: "user" },
        { id: uid(), name: "Streaming subscriptions", essential: false, expectedAmountMinor: toMinor(1500, cur), cadence: "monthly", dueDay: 22, confidence: 1, source: "user" },
      ],
      categories: [
        { id: "cat-groceries", name: "Groceries", kind: "flexible", baselineWeight: 5, floorMinor: toMinor(18000, cur) },
        { id: "cat-transport", name: "Transport", kind: "flexible", baselineWeight: 3, floorMinor: toMinor(6000, cur) },
        { id: "cat-dining", name: "Dining out", kind: "flexible", baselineWeight: 2 },
        { id: "cat-shopping", name: "Shopping", kind: "flexible", baselineWeight: 2 },
        { id: "cat-fun", name: "Entertainment", kind: "flexible", baselineWeight: 1 },
      ],
      emergency: { current: toMinor(60000, cur), target: toMinor(240000, cur) },
      preferences: { savingsStyle: "balanced", buffer: { kind: "percent_of_income", value: 5 }, bufferBeforeGoals: false },
      goals: [
        { id: uid(), name: "Emergency fund top-up", targetAmountMinor: toMinor(240000, cur), savedAmountMinor: toMinor(60000, cur), currency: cur, priority: 1, status: "active" },
        { id: uid(), name: "Motorbike upgrade", targetAmountMinor: toMinor(220000, cur), savedAmountMinor: toMinor(85000, cur), currency: cur, targetDate: (new Date().getFullYear() + 1) + "-06", priority: 2, status: "active" },
      ],
      transactions: [
        tx(2, 2450, "Imtiaz Super Market", "cat-groceries", "manual"),
        tx(3, 800, "Careem ride", "cat-transport", "text"),
        tx(4, 3200, "Dinner with family", "cat-dining", "manual"),
        tx(6, 5100, "Grocery run", "cat-groceries", "manual"),
        tx(7, 1500, "Petrol", "cat-transport", "text"),
        tx(8, 2799, "Movie night", "cat-fun", "manual"),
        tx(9, 4300, "Weekly groceries", "cat-groceries", "manual"),
      ],
      plans: [],
    };
    const plan = generatePlan(acct, currentPeriod());
    approvePlan(acct, plan.id);
    return acct;
  }

  // ---------- engine adapters ----------
  function generatePlan(a, period) {
    const plan = S.calculateMonthPlan({
      period, currency: a.currency,
      incomeSources: a.incomeSources, commitments: a.commitments, categories: a.categories,
      emergency: { currentAmountMinor: a.emergency.current, targetAmountMinor: a.emergency.target },
      preferences: a.preferences, goals: a.goals,
      planId: uid(), userId: "demo", createdAt: new Date().toISOString(),
    });
    a.plans.push(plan);
    return plan;
  }
  function approvePlan(a, id) {
    for (const p of a.plans) if (samePeriod(p.period, currentPeriod()) && p.status === "approved") p.status = "superseded";
    const p = a.plans.find((x) => x.id === id);
    if (p) { p.status = "approved"; p.approvedAt = new Date().toISOString(); }
    return p;
  }
  const currentPlan = (a, period) =>
    a.plans.filter((p) => samePeriod(p.period, period)).sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0];
  const latestPlan = (a) => a.plans.slice().sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0];

  function upcomingObligations(a, today) {
    const day = Number(today.slice(8, 10));
    return a.commitments.filter((c) => c.essential)
      .map((c) => ({ recurringItemId: c.id, name: c.name, amountMinor: S.monthlyEquivalent(c.expectedAmountMinor, c.cadence), dueDay: c.dueDay }))
      .filter((o) => o.dueDay == null || o.dueDay >= day);
  }
  function safeToSpend(a) {
    const period = currentPeriod(), today = todayISO();
    const plan = currentPlan(a, period);
    if (!plan || plan.status !== "approved") {
      const expected = a.incomeSources.reduce((s, i) => s + i.expectedAmountMinor, 0);
      const essentials = upcomingObligations(a, today).reduce((s, o) => s + o.amountMinor, 0);
      return { estimated: true, period, currency: a.currency, daysRemaining: S.daysRemainingInPeriod(today, period),
        availableNow: { amountMinor: Math.max(0, expected - essentials), currency: a.currency },
        dailyRecommended: { amountMinor: 0, currency: a.currency },
        note: "Estimated — approve this month's plan for exact numbers." };
    }
    return S.calculateSafeToSpend({
      today, period, currency: a.currency,
      flexibleBudget: plan.allocations.flexible.map((f) => ({ categoryId: f.categoryId, plannedMinor: f.planned.amountMinor })),
      transactions: a.transactions,
      upcomingObligations: upcomingObligations(a, today),
    });
  }
  function insights(a) {
    const period = currentPeriod(), today = todayISO();
    const plan = currentPlan(a, period);
    const variance = plan ? S.detectBudgetVariance({
      period, currency: a.currency,
      planned: plan.allocations.flexible.map((f) => ({ categoryId: f.categoryId, name: f.name, plannedMinor: f.planned.amountMinor })),
      transactions: a.transactions,
    }) : null;
    const essentialsMonthly = a.commitments.filter((c) => c.essential)
      .reduce((s, c) => s + S.monthlyEquivalent(c.expectedAmountMinor, c.cadence), 0);
    const emergency = S.calculateEmergencyFundStatus({
      currency: a.currency, currentAmountMinor: a.emergency.current, targetAmountMinor: a.emergency.target,
      monthlyContributionMinor: plan ? plan.allocations.emergency.amountMinor : 0,
      averageMonthlyEssentialsMinor: essentialsMonthly,
    });
    const recurring = S.forecastRecurringCosts(a.commitments, period, a.currency);
    const overspending = variance ? variance.lines.filter((l) => l.status === "over" || l.status === "at_risk").sort((x, y) => y.percentUsed - x.percentUsed) : [];
    return { period, variance, emergency, recurring, overspending, plan };
  }
  function monthEnd(a) {
    const plan = currentPlan(a, currentPeriod());
    return S.learnCategoryWeights({
      period: currentPeriod(),
      categories: plan ? plan.allocations.flexible.map((f) => {
        const c = a.categories.find((x) => x.id === f.categoryId);
        return { id: f.categoryId, name: f.name, baselineWeight: c ? c.baselineWeight : f.weight };
      }) : [],
      plannedMinor: plan ? plan.allocations.flexible.map((f) => ({ categoryId: f.categoryId, plannedMinor: f.planned.amountMinor })) : [],
      transactions: a.transactions,
    });
  }
  function rollover(a) {
    const lr = monthEnd(a);
    if (lr.evidence.sufficient) {
      for (const ch of lr.changes) {
        const c = a.categories.find((x) => x.id === ch.categoryId);
        if (c) c.baselineWeight = ch.toWeight;
      }
    }
    const plan = generatePlan(a, S.addPeriods(currentPeriod(), 1));
    plan.adaptations = lr.evidence.sufficient ? lr.changes : [];
    return { plan, applied: lr.evidence.sufficient, evidence: lr.evidence };
  }
  function addTransaction(a, t) {
    a.transactions.push({
      id: uid(), userId: "demo",
      amount: { amountMinor: toMinor(t.amount, a.currency), currency: a.currency },
      date: t.date || todayISO(), merchant: t.merchant, categoryId: t.categoryId,
      source: t.source || "manual", confidence: t.confidence != null ? t.confidence : 1,
      createdAt: new Date().toISOString(),
    });
  }

  // ---------- text parser (same rule table as the API) ----------
  const KEYWORDS = [
    ["cat-transport", ["petrol", "fuel", "uber", "careem", "bus", "train", "taxi", "metro", "gas"]],
    ["cat-dining", ["dinner", "lunch", "breakfast", "coffee", "restaurant", "cafe", "chai", "food"]],
    ["cat-groceries", ["grocery", "groceries", "supermarket", "sabzi", "kirana"]],
    ["cat-shopping", ["shoes", "clothes", "shopping", "mall", "kurta"]],
    ["cat-health", ["pharmacy", "medicine", "doctor", "clinic"]],
    ["cat-fun", ["movie", "cinema", "game", "concert", "netflix"]],
  ];
  function parseText(text) {
    const lower = text.toLowerCase();
    const m = /([0-9][0-9,]*(?:\.[0-9]+)?)/.exec(text.replace(/rs\.?\s*/gi, ""));
    const amount = m ? Number(m[1].replace(/,/g, "")) : null;
    let date = todayISO();
    const yesterday = /\byesterday\b|\bkal\b/i.test(lower);
    if (yesterday) date = todayISO(-1);
    let merchant = lower
      .replace(/([0-9][0-9,]*(?:\.[0-9]+)?)/g, " ")
      .replace(/\b(spent|spend|paid|pay|kharch|kharcha|hua|huwa|on|pe|par|for|aaj|kal|yesterday|today|rs|pkr)\b/g, " ")
      .replace(/\s+/g, " ").trim() || "Expense";
    let categoryId = null, confidence = 0.35;
    for (const [id, words] of KEYWORDS) if (words.some((w) => lower.includes(w))) { categoryId = id; confidence = 0.8; break; }
    return { amount, merchant, categoryId, date, confidence };
  }

  // ---------- grounded mini-assistant (engine numbers only) ----------
  function assistantReply(a, text) {
    const lower = text.toLowerCase();
    const sts = safeToSpend(a);
    const spend = /(?:can i|should i|may i)\s+(?:spend|buy|afford)|kharch/.test(lower) && /([0-9][0-9,]*(?:\.[0-9]+)?)/.exec(lower.replace(/rs\.?/g, ""));
    if (spend) {
      const requested = toMinor(Number(spend[1].replace(/,/g, "")), a.currency);
      if (!sts || sts.estimated) return { text: "Approve this month's plan first and I can answer spending questions with exact numbers.", calc: "estimated" };
      const after = sts.availableNow.amountMinor - requested;
      const fits = after >= 0;
      return {
        text: fits
          ? "Yes — " + fmt(requested) + " fits. You'd still have about " + fmt(after) + " of flexible money after it."
          : "Not comfortably. " + fmt(requested) + " exceeds your " + fmt(sts.availableNow.amountMinor) + " remaining flexible money" +
            (sts.breakdown.reservedForUpcomingObligations.amountMinor > 0 ? ", and " + fmt(sts.breakdown.reservedForUpcomingObligations.amountMinor) + " is reserved for upcoming bills" : "") + ".",
        calc: "safe-to-spend:" + sts.calculationVersion,
      };
    }
    const cat = a.categories.find((c) => lower.includes(c.name.toLowerCase()));
    if (cat) {
      const line = insights(a).variance && insights(a).variance.lines.find((l) => l.categoryId === cat.id);
      if (line) {
        const left = Math.max(0, line.planned.amountMinor - line.actual.amountMinor);
        return { text: cat.name + ": planned " + fmt(line.planned.amountMinor) + ", spent " + fmt(line.actual.amountMinor) + " — " + fmt(left) + " left" + (line.status === "over" ? " (over target)" : "") + ".", calc: "variance:" + line.calculationVersion };
      }
    }
    const i = insights(a);
    const parts = [];
    if (!sts.estimated) parts.push("You have " + fmt(sts.availableNow.amountMinor) + " of flexible money left (≈" + fmt(sts.dailyRecommended.amountMinor) + "/day).");
    if (i.overspending.length) parts.push(i.overspending[0].name + " is trending over target.");
    parts.push("Emergency fund covers " + i.emergency.essentialsCoverageMonths + " months of essentials.");
    return { text: parts.join(" "), calc: "engine:insights" };
  }

  // ---------- trial ----------
  function trialState(a) {
    if (a.subscription.status === "active") return { state: "active" };
    const end = new Date(a.createdAt).getTime() + 3 * 86400000;
    if (Date.now() < end) return { state: "trialing", days: Math.max(1, Math.ceil((end - Date.now()) / 86400000)), end };
    return { state: "expired" };
  }

  // ---------- views ----------
  const $app = document.getElementById("app");
  const $tabbar = document.getElementById("tabbar");
  const TABS = [["home", "◉", "Home"], ["plan", "≡", "Plan"], ["spend", "+", "Spend"], ["insights", "◔", "Insights"], ["profile", "☺", "Profile"]];

  function render() {
    if (!state.account) return renderWelcome();
    $tabbar.innerHTML = TABS.map(([id, icon, label]) => '<button data-tab="' + id + '" class="' + (state.view === id ? "active" : "") + '">' + icon + "<br/>" + label + "</button>").join("");
    $tabbar.classList.remove("hidden");
    $tabbar.querySelectorAll("button").forEach((b) => (b.onclick = () => { state.view = b.dataset.tab; render(); }));
    const views = { home: viewHome, plan: viewPlan, spend: viewSpend, insights: viewInsights, profile: viewProfile };
    views[state.view]();
  }

  function trialBanner() {
    const t = trialState(state.account);
    if (t.state === "active") return "";
    if (t.state === "trialing")
      return '<div class="card notice-trial"><div><span class="badge">Trial · ' + t.days + ' day' + (t.days === 1 ? "" : "s") + ' left</span><div class="note" style="margin-top:6px">Full access, all features. This demo is local — nothing leaves your browser.</div></div><button class="primary" onclick="SAI.demo.subscribe()">Keep it</button></div>';
    return '<div class="card notice-trial"><div><span class="badge red">Trial ended</span><div class="note" style="margin-top:6px">In the real product, paid features pause here and your data is preserved.</div></div><button class="primary" onclick="SAI.demo.subscribe()">Subscribe</button></div>';
  }

  function renderWelcome() {
    $tabbar.classList.add("hidden");
    $app.innerHTML =
      '<div class="onboard"><div class="logo">💸</div><h1>Salary AI</h1>' +
      "<p>I’ll learn how you use money and turn each salary into a plan that adapts to your life.</p>" +
      '<div class="card" style="text-align:left">' +
      '<button class="primary wide" id="btn-demo">Try the live demo</button>' +
      '<div class="note" style="text-align:center">Seeded demo account · 3-day trial · runs 100% in your browser — the real deterministic finance engine, no server</div>' +
      '<div class="row"><div class="label">Engine</div><div class="value num">v' + S.FINANCE_ENGINE_VERSION + '</div></div>' +
      "</div></div>";
    document.getElementById("btn-demo").onclick = () => {
      state.account = freshAccount();
      state.chat = [];
      save();
      state.view = "home";
      render();
    };
  }

  function viewHome() {
    const a = state.account;
    const sts = safeToSpend(a);
    const goals = a.goals;
    const cur = a.currency;
    $app.innerHTML =
      "<h1>" + (new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening") + "</h1>" +
      '<div class="sub">' + (sts.estimated ? "Estimated view" : monthName(sts.period)) + " · " + esc(cur) + "</div>" +
      trialBanner() +
      '<div class="card hero"><h2>Safe to spend</h2><div class="amount num ' + (sts.availableNow.amountMinor === 0 ? "zero" : "") + '">' + fmt(sts.availableNow.amountMinor, cur) + "</div>" +
      (sts.estimated
        ? '<div class="note">' + esc(sts.note) + "</div>"
        : '<div class="perday num">≈ ' + fmt(sts.dailyRecommended.amountMinor, cur) + "/day for the next " + sts.daysRemaining + " days</div>" +
          '<div class="pill-row"><span class="pill">Flexible left ' + fmt(sts.breakdown.flexibleRemaining.amountMinor, cur) + '</span><span class="pill">Reserved for bills ' + fmt(sts.breakdown.reservedForUpcomingObligations.amountMinor, cur) + "</span>" +
          (sts.breakdown.overspend.amountMinor > 0 ? '<span class="pill" style="color:var(--red)">Overspent ' + fmt(sts.breakdown.overspend.amountMinor, cur) + "</span>" : "") + "</div>") +
      "</div>" +
      '<div class="card"><h2>Goals</h2>' +
      (goals.length
        ? goals.map((g) => {
            const pct = Math.min(100, Math.round((g.savedAmountMinor / Math.max(1, g.targetAmountMinor)) * 100));
            const plan = currentPlan(a, currentPeriod());
            const planned = plan && plan.allocations.goals.find((x) => x.goalId === g.id);
            return '<div class="row"><div class="label">' + esc(g.name) + "<small>" + pct + "% · " + fmt(planned ? planned.planned.amountMinor : 0, cur) + "/mo planned</small></div><div class=\"value num\">" + fmt(g.savedAmountMinor, cur) + '</div></div><div class="bar"><span style="width:' + pct + '%"></span></div>';
          }).join("")
        : '<div class="note">No goals yet.</div>') +
      "</div>" +
      '<div class="card"><h2>Ask your assistant</h2><div id="chatbox"></div></div>';
    bindChat();
  }

  function viewPlan() {
    const a = state.account;
    let plan = currentPlan(a, currentPeriod());
    let isNext = false;
    if (!plan) { plan = latestPlan(a); isNext = true; }
    if (!plan) {
      $app.innerHTML = "<h1>Salary Plan</h1>" + trialBanner() +
        '<div class="card hero"><h2>No plan yet</h2><p class="sub">Obligations protected first, then safety, goals and flexible spending.</p><button class="primary wide" id="gen">Generate this month’s plan</button></div>';
      document.getElementById("gen").onclick = () => { generatePlan(a, currentPeriod()); save(); render(); };
      return;
    }
    const t = plan.totals, cur = plan.currency;
    $app.innerHTML =
      "<h1>Salary Plan</h1>" +
      '<div class="sub">' + monthName(plan.period) + (isNext || !samePeriod(plan.period, currentPeriod()) ? " · <strong>upcoming</strong>" : "") + ' · <span class="badge ' + (plan.status === "approved" ? "" : "warn") + '">' + plan.status + "</span> · engine v" + esc(plan.calculationVersion) + "</div>" +
      plan.warnings.map((w) => '<div class="warnbox">' + esc(w.message) + "</div>").join("") +
      ((plan.adaptations || []).length
        ? '<div class="card"><h2>Learned from last month</h2>' + plan.adaptations.map((ad) => '<div class="row"><div class="label">' + esc(ad.name) + (ad.material ? ' <span class="badge warn">notable</span>' : "") + "<small>" + esc(ad.reason) + '</small></div><div class="value num">' + ad.fromWeight + " → " + ad.toWeight + "</div></div>").join("") + "</div>"
        : "") +
      '<div class="card"><h2>Income</h2><div class="row"><div class="label">Expected take-home' + (plan.warnings.some((w) => w.code === "variable_income_haircut_applied") ? " <small>10% haircut on variable income</small>" : "") + '</div><div class="value num">' + fmt(t.income.amountMinor, cur) + "</div></div></div>" +
      '<div class="card"><h2>Protected money</h2>' +
      plan.allocations.obligations.map((o) => '<div class="row"><div class="label">' + esc(o.name) + (o.dueDay ? "<small>due day " + o.dueDay + "</small>" : "") + '</div><div class="value num">' + fmt(o.amount.amountMinor, cur) + "</div></div>").join("") +
      '<div class="row"><div class="label"><strong>Protected total</strong></div><div class="value num">' + fmt(t.protected.amountMinor, cur) + "</div></div></div>" +
      '<div class="card"><h2>Future money</h2>' +
      '<div class="row"><div class="label">Emergency fund</div><div class="value num">' + fmt(t.emergency.amountMinor, cur) + "</div></div>" +
      plan.allocations.goals.map((g) => '<div class="row"><div class="label">' + esc(g.name) + "<small>priority " + g.priority + (g.requiredMonthlyPaceMinor ? " · pace " + fmt(g.requiredMonthlyPaceMinor, cur) + "/mo" : "") + '</small></div><div class="value num ' + (g.planned.amountMinor === 0 ? "dim" : "") + '">' + fmt(g.planned.amountMinor, cur) + "</div></div>").join("") +
      '<div class="row"><div class="label">Buffer</div><div class="value num">' + fmt(t.buffer.amountMinor, cur) + "</div></div></div>" +
      '<div class="card"><h2>Life spending</h2>' +
      plan.allocations.flexible.map((f) => '<div class="row"><div class="label">' + esc(f.name) + '</div><div class="value num">' + fmt(f.planned.amountMinor, cur) + "</div></div>").join("") +
      '<div class="row"><div class="label"><strong>Flexible total</strong></div><div class="value num">' + fmt(t.flexible.amountMinor, cur) + "</div></div></div>" +
      (plan.status === "draft" && samePeriod(plan.period, currentPeriod())
        ? '<button class="primary wide" id="approve">Approve plan</button>'
        : '<div class="note">Approved ' + (plan.approvedAt ? new Date(plan.approvedAt).toLocaleString() : "") + "</div>") +
      '<button class="wide ghost" id="regen">Regenerate plan</button>';
    const ap = document.getElementById("approve");
    if (ap) ap.onclick = () => { approvePlan(a, plan.id); save(); render(); };
    document.getElementById("regen").onclick = () => { generatePlan(a, plan.period); save(); render(); };
  }

  function viewSpend() {
    const a = state.account;
    const catName = (id) => { const c = a.categories.find((x) => x.id === id); return c ? c.name : "Uncategorized"; };
    const txns = a.transactions.slice().sort((x, y) => y.date.localeCompare(x.date)).slice(0, 40);
    $app.innerHTML =
      "<h1>Spending</h1>" +
      '<div class="card"><h2>Quick add</h2><input id="tx-text" placeholder="e.g. Spent 950 on dinner · Aaj petrol pe 3000 kharch hua" /><button class="primary wide" id="tx-parse">Preview</button><div id="tx-draft"></div></div>' +
      '<div class="card"><h2>Recent</h2>' +
      (txns.length
        ? txns.map((t) => '<div class="row"><div class="label">' + esc(t.merchant) + "<small>" + esc(catName(t.categoryId)) + " · " + t.date + " · " + t.source + '</small></div><div class="value num neg">−' + fmt(t.amount.amountMinor, t.amount.currency) + "</div></div>").join("")
        : '<div class="note">No transactions yet.</div>') +
      "</div>";
    document.getElementById("tx-parse").onclick = () => {
      const text = document.getElementById("tx-text").value.trim();
      if (!text) return;
      const d = parseText(text);
      if (d.amount == null) { document.getElementById("tx-draft").innerHTML = '<div class="warnbox">Couldn’t find an amount — try “Spent 950 on dinner”.</div>'; return; }
      const cat = a.categories.find((c) => c.id === d.categoryId);
      state.draft = d;
      document.getElementById("tx-draft").innerHTML =
        '<div class="row"><div class="label">' + esc(d.merchant) + "<small>" + (cat ? esc(cat.name) : "category uncertain — saving teaches the system") + " · confidence " + Math.round(d.confidence * 100) + '%</small></div><div class="value num neg">−' + fmt(toMinor(d.amount, a.currency), a.currency) + '</div></div><button class="primary wide" id="tx-save">Save transaction</button>';
      document.getElementById("tx-save").onclick = () => {
        addTransaction(a, { amount: d.amount, merchant: d.merchant, categoryId: d.categoryId || undefined, source: "text", confidence: d.confidence, date: d.date });
        state.draft = null; save(); render();
      };
    };
  }

  function viewInsights() {
    const a = state.account;
    const i = insights(a);
    const me = monthEnd(a);
    const cur = a.currency;
    $app.innerHTML =
      "<h1>Insights</h1>" +
      '<div class="sub">' + monthName(i.period) + " · " + a.transactions.length + " transactions · engine v" + esc(i.emergency.calculationVersion) + "</div>" +
      '<div class="card"><h2>Month-end review</h2>' +
      (me.evidence.sufficient
        ? "<div class=\"note\">Compared " + me.evidence.categorizedInPeriod + " categorized transactions against your plan — proposed adjustments for " + monthName(S.addPeriods(currentPeriod(), 1)) + ":</div>" +
          me.changes.map((p) => '<div class="row"><div class="label">' + esc(p.name) + (p.material ? ' <span class="badge warn">notable</span>' : "") + "<small>" + esc(p.reason) + '</small></div><div class="value num">' + p.fromWeight + " → " + p.toWeight + "</div></div>").join("") +
          '<button class="primary wide" id="rollover">Plan ' + monthName(S.addPeriods(currentPeriod(), 1)) + " with these adjustments</button>"
        : '<div class="note">' + (currentPlan(a, currentPeriod()) ? "Not enough evidence yet — " + me.evidence.categorizedInPeriod + " categorized transactions this month (need 4+). Keep recording spending." : "Approve this month's plan first — learning compares behavior against it.") + "</div>") +
      "</div>" +
      '<div class="card"><h2>Emergency fund</h2><div class="bar"><span class="' + (i.emergency.progressPercent >= 100 ? "" : "warn") + '" style="width:' + Math.min(100, i.emergency.progressPercent) + '%"></span></div>' +
      '<div class="row"><div class="label">Progress<small>' + i.emergency.essentialsCoverageMonths + ' months of essentials covered</small></div><div class="value num">' + fmt(i.emergency.current.amountMinor, cur) + " / " + fmt(i.emergency.target.amountMinor, cur) + "</div></div></div>" +
      '<div class="card"><h2>Budget vs actual</h2>' +
      (i.variance
        ? i.variance.lines.map((l) => '<div class="row"><div class="label">' + esc(l.name) + "<small>" + l.percentUsed + '% used</small></div><div class="value num ' + (l.status === "over" ? "neg" : l.status === "on_track" ? "pos" : "dim") + '">' + fmt(l.actual.amountMinor, cur) + ' <span class="dim">/ ' + fmt(l.planned.amountMinor, cur) + "</span></div></div>").join("")
        : '<div class="note">Approve a plan to compare against it.</div>') +
      "</div>" +
      '<div class="card"><h2>Recurring costs</h2><div class="row"><div class="label">Expected this month<small>range ' + fmt(i.recurring.totalRange.low.amountMinor, cur) + " – " + fmt(i.recurring.totalRange.high.amountMinor, cur) + '</small></div><div class="value num">' + fmt(i.recurring.totalExpected.amountMinor, cur) + "</div></div>" +
      i.recurring.lines.filter((l) => l.confidence < 1).map((l) => '<div class="note">' + esc(l.name) + ": uncertain range " + fmt(l.range.low.amountMinor, cur) + "–" + fmt(l.range.high.amountMinor, cur) + "</div>").join("") +
      "</div>";
    const btn = document.getElementById("rollover");
    if (btn)
      btn.onclick = () => {
        btn.disabled = true;
        btn.textContent = "Planning…";
        setTimeout(() => {
          const r = rollover(a);
          save();
          state.view = "plan";
          render();
        }, 250);
      };
  }

  function viewProfile() {
    const a = state.account;
    $app.innerHTML =
      "<h1>Profile</h1>" +
      '<div class="card"><h2>Trial & billing</h2>' + (trialBanner() || '<div class="note">Subscription active.</div>') + "</div>" +
      '<div class="card"><h2>World settings</h2>' +
      "<label>Currency</label><select id=\"pf-cur\">" + ["PKR", "USD", "EUR", "GBP", "INR", "AED", "SAR", "JPY", "CAD", "AUD"].map((c) => '<option ' + (c === a.currency ? "selected" : "") + ">" + c + "</option>").join("") + "</select>" +
      "<label>Savings style</label><div class=\"pill-row\">" + ["conservative", "balanced", "ambitious"].map((s) => '<span class="pill" data-style="' + s + '" style="cursor:pointer;' + (s === a.preferences.savingsStyle ? "color:var(--accent);border-color:var(--accent)" : "") + '">' + s + "</span>").join("") + "</div>" +
      '<button class="wide" id="pf-save">Save settings <small>(next plans use them)</small></button></div>' +
      '<div class="card"><h2>Your data</h2>' +
      '<button class="wide" id="pf-export">Export my data (JSON)</button>' +
      '<button class="wide ghost" id="pf-reset" style="color:var(--red)">Reset demo</button>' +
      '<div class="note">Everything lives in this browser (localStorage). The engine and its version badge are the real packages from the repo.</div></div>';
    document.getElementById("pf-save").onclick = () => {
      a.currency = document.getElementById("pf-cur").value;
      save();
      render();
    };
    $app.querySelectorAll("[data-style]").forEach((el) => {
      el.onclick = () => { a.preferences.savingsStyle = el.dataset.style; save(); viewProfile(); };
    });
    document.getElementById("pf-export").onclick = () => {
      const blob = new Blob([JSON.stringify(a, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "salary-ai-demo-export.json";
      link.click();
    };
    document.getElementById("pf-reset").onclick = () => {
      localStorage.removeItem(KEY);
      state.account = null;
      render();
    };
  }

  // ---------- chat ----------
  function bindChat() {
    const box = document.getElementById("chatbox");
    if (!box) return;
    box.innerHTML =
      '<div class="chatlog">' + state.chat.map((m) => '<div class="msg ' + (m.role === "user" ? "user" : "ai") + '">' + esc(m.text) + (m.meta ? '<div class="meta">' + esc(m.meta) + "</div>" : "") + "</div>").join("") + "</div>" +
      '<input id="chat-in" placeholder="Ask: Can I spend 5000 on shoes?" /><button class="primary wide" id="chat-send">Ask</button>';
    document.getElementById("chat-send").onclick = sendChat;
    document.getElementById("chat-in").addEventListener("keydown", (e) => { if (e.key === "Enter") sendChat(); });
  }
  function sendChat() {
    const input = document.getElementById("chat-in");
    const text = input.value.trim();
    if (!text) return;
    state.chat.push({ role: "user", text });
    const r = assistantReply(state.account, text);
    state.chat.push({ role: "ai", text: r.text, meta: "grounded in " + r.calc });
    render();
    const log = document.querySelector(".chatlog");
    if (log) log.scrollTop = log.scrollHeight;
  }

  // ---------- global hooks ----------
  window.SAI = window.SAI || {};
  window.SAI.demo = {
    subscribe() {
      state.account.subscription = { status: "active" };
      save();
      render();
    },
  };

  // ---------- boot ----------
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state.account = JSON.parse(raw);
  } catch (e) {}
  render();
})();
