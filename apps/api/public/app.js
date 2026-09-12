/* Salary AI demo client. Talks only to same-origin /v1 endpoints. */
const $app = document.getElementById("app");
const $tabbar = document.getElementById("tabbar");

const state = {
  token: localStorage.getItem("token") ?? null,
  profile: null,
  billing: null,
  chat: [],
  chatSession: null,
  ob: null, // onboarding draft
  obStep: 0,
};

// ---------- helpers ----------
async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && state.token) logout(false);
    const err = new Error(body.message ?? `Request failed (${res.status})`);
    err.status = res.status; err.body = body;
    throw err;
  }
  return body;
}

const SYMBOLS = { PKR: "Rs", USD: "$", EUR: "€", GBP: "£", INR: "₹", AED: "AED", SAR: "SAR", JPY: "¥", CAD: "C$", AUD: "A$" };
function fmt(minor, currency = state.profile?.currency ?? "USD") {
  const info = { PKR: 2, USD: 2, EUR: 2, GBP: 2, INR: 2, JPY: 0 }[currency] ?? 2;
  const symbol = SYMBOLS[currency] ?? currency;
  const abs = Math.abs(minor) / 10 ** info;
  const n = abs.toLocaleString("en-US", { minimumFractionDigits: info, maximumFractionDigits: info });
  return `${minor < 0 ? "−" : ""}${symbol} ${n}`;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function monthName(p) { return new Date(Date.UTC(p.year, p.month - 1, 1)).toLocaleString("en", { month: "long", year: "numeric" }); }
function nextMonthName() {
  const d = new Date(); d.setMonth(d.getMonth() + 1);
  return d.toLocaleString("en", { month: "long", year: "numeric" });
}

function setTabbar(active) {
  $tabbar.innerHTML = TABS.map((t) => `<button data-tab="${t.id}" class="${t.id === active ? "active" : ""}">${t.icon}<br/>${t.label}</button>`).join("");
  $tabbar.classList.remove("hidden");
  $tabbar.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => go(b.dataset.tab)));
}
const TABS = [
  { id: "home", label: "Home", icon: "◉" },
  { id: "plan", label: "Plan", icon: "≡" },
  { id: "transactions", label: "Spend", icon: "+" },
  { id: "insights", label: "Insights", icon: "◔" },
  { id: "profile", label: "Profile", icon: "☺" },
];

function go(tab) { location.hash = `#/${tab}`; render(); }

// ---------- routing ----------
function needsOnboarding() {
  return state.profile && state.profile.incomeSources.length === 0 && localStorage.getItem(`ob-skipped-${state.profile.userId}`) !== "1";
}

function render() {
  const route = (location.hash.replace(/^#\//, "") || "home").split("?")[0];
  if (!state.token) return renderWelcome();
  if (needsOnboarding()) { $tabbar.classList.add("hidden"); return renderOnboarding(); }
  setTabbar(TABS, TABS.some((t) => t.id === route) ? route : "home");
  const views = { home: renderHome, plan: renderPlan, transactions: renderTransactions, insights: renderInsights, profile: renderProfile };
  (views[route] ?? renderHome)();
}

// ---------- welcome ----------
function renderWelcome() {
  $tabbar.classList.add("hidden");
  $app.innerHTML = `
    <div class="onboard">
      <div class="logo">💸</div>
      <h1>Salary AI</h1>
      <p>I’ll learn how you use money and turn each salary into a plan that adapts to your life.</p>
      <div class="card" style="text-align:left">
        <button class="primary wide" id="btn-demo">Try the live demo</button>
        <div class="note" style="text-align:center">Creates a seeded demo account · 3-day trial · no real money</div>
        <label>Email</label><input id="in-email" type="email" placeholder="you@example.com" />
        <label>Password</label><input id="in-pass" type="password" placeholder="min 8 characters" />
        <label>Currency</label>
        <select id="in-cur">${["USD", "PKR", "EUR", "GBP", "INR", "AED", "SAR", "JPY", "CAD", "AUD"].map((c) => `<option>${c}</option>`).join("")}</select>
        <button class="wide" id="btn-register">Create account</button>
        <div id="auth-error" class="warnbox hidden"></div>
      </div>
    </div>`;
  document.getElementById("btn-demo").onclick = async () => {
    const seeded = await api("/v1/demo/seed", { method: "POST" });
    state.token = seeded.token;
    localStorage.setItem("token", seeded.token);
    state.chat = []; state.chatSession = null;
    await loadAccount();
    go("home");
  };
  document.getElementById("btn-register").onclick = async () => {
    const email = document.getElementById("in-email").value.trim();
    const password = document.getElementById("in-pass").value;
    const currency = document.getElementById("in-cur").value;
    try {
      const reg = await api("/v1/auth/register", { method: "POST", body: JSON.stringify({ email, password, currency }) });
      state.token = reg.token; localStorage.setItem("token", reg.token);
      state.chat = []; state.chatSession = null;
      await loadAccount();
      render(); // fresh account → onboarding wizard
    } catch (e) {
      const box = document.getElementById("auth-error");
      box.textContent = e.message; box.classList.remove("hidden");
    }
  };
}

async function loadAccount() {
  state.profile = await api("/v1/profile");
  state.billing = await api("/v1/billing/status");
}

// ---------- onboarding wizard ----------
const OB_STEPS = ["Welcome", "Income", "Commitments", "Lifestyle", "Safety", "Goals", "Style", "Your plan"];

function obDraft() {
  if (!state.ob) {
    state.ob = {
      income: [{ name: "Salary", amount: "", payday: 1, reliability: "stable" }],
      commitments: [{ name: "", amount: "", dueDay: 1, essential: true }],
      emergency: { current: "", target: "" },
      goals: [{ name: "", target: "", date: "" }],
      savingsStyle: "balanced",
      bufferPct: 5,
    };
  }
  return state.ob;
}

function obShell(title, subtitle, body, opts = {}) {
  const step = state.obStep;
  $app.innerHTML = `
    <div class="ob-progress">${OB_STEPS.map((s, i) => `<span class="${i <= step ? "on" : ""}"></span>`).join("")}</div>
    <h1>${esc(title)}</h1>
    <div class="sub">${subtitle}</div>
    <div class="card">${body}</div>
    <div style="display:flex;gap:10px;margin-top:14px">
      ${step > 0 ? '<button class="ghost" id="ob-back">Back</button>' : ""}
      ${opts.skipLabel ? `<button class="ghost" id="ob-skip" style="flex:1">${opts.skipLabel}</button>` : ""}
      <button class="primary" id="ob-next" style="flex:2">${opts.nextLabel ?? "Continue"}</button>
    </div>
    <div id="ob-error"></div>`;
  if (document.getElementById("ob-back")) document.getElementById("ob-back").onclick = () => { state.obStep--; render(); };
  if (document.getElementById("ob-skip")) document.getElementById("ob-skip").onclick = opts.onSkip;
  document.getElementById("ob-next").onclick = opts.onNext;
}

function renderOnboarding() {
  const ob = obDraft();
  const step = state.obStep;

  if (step === 0) {
    return obShell("I’ll learn how you use money", "Answer once — then every month gets planned around your actual life. Takes about two minutes.", `
      <div class="row"><div class="label">📋 Your income & payday</div></div>
      <div class="row"><div class="label">🏠 Rent, bills & family commitments</div></div>
      <div class="row"><div class="label">🍜 Everyday flexible spending</div></div>
      <div class="row"><div class="label">🛟 Emergency fund & goals</div></div>
      <div class="note">Your first plan will be an estimate that improves as you record real spending. Everything stays private and exportable.</div>
    `, { nextLabel: "Let’s go" , onNext: () => { state.obStep = 1; render(); } });
  }

  if (step === 1) { // Income
    return obShell("Income", "Take-home amount, how often, and when it lands.", `
      ${ob.income.map((inc, i) => `
        <label>Source name</label><input data-inc="${i}" data-field="name" value="${esc(inc.name)}" placeholder="Salary, freelance…" />
        <label>Amount per month (${esc(state.profile.currency)})</label><input data-inc="${i}" data-field="amount" type="number" min="0" inputmode="decimal" value="${inc.amount}" placeholder="e.g. 150000" />
        <label>Payday (day of month)</label><input data-inc="${i}" data-field="payday" type="number" min="1" max="28" value="${inc.payday}" />
        <label>Stability</label>
        <select data-inc="${i}" data-field="reliability">
          <option value="stable" ${inc.reliability === "stable" ? "selected" : ""}>Stable — same most months</option>
          <option value="variable" ${inc.reliability === "variable" ? "selected" : ""}>Variable — changes month to month</option>
        </select>`).join("")}
      <button class="wide ghost" id="ob-add-income" style="margin-top:10px">+ Add another source</button>
      <div class="note">Variable income gets a conservative haircut so the plan stays realistic.</div>
    `, {
      skipLabel: "Add later",
      onSkip: () => { state.obStep = 2; render(); },
      onNext: async () => {
        $app.querySelectorAll("[data-inc]").forEach((el) => {
          const i = Number(el.dataset.inc);
          const field = el.dataset.field;
          ob.income[i][field] = field === "name" || field === "reliability" ? el.value : Number(el.value);
        });
        const valid = ob.income.filter((s) => s.name && s.amount > 0);
        if (valid.length === 0) return obError("Add at least one income amount to plan around — or skip.");
        state.profile = await api("/v1/profile", { method: "PUT", body: JSON.stringify({
          incomeSources: valid.map((s) => ({ name: s.name, expectedAmount: s.amount, frequency: "monthly", paydayDay: s.payday || 1, reliability: s.reliability })),
        })});
        state.obStep = 2; render();
      },
    });
  }

  if (step === 2) { // Commitments
    return obShell("Recurring commitments", "Rent, utilities, debt payments, family support — money that must go out.", `
      ${ob.commitments.map((c, i) => `
        <div style="border-top:1px solid var(--border);padding-top:8px;margin-top:8px">
          <label>What</label><input data-com="${i}" data-field="name" value="${esc(c.name)}" placeholder="Rent, electricity…" />
          <label>Amount (${esc(state.profile.currency)})</label><input data-com="${i}" data-field="amount" type="number" min="0" inputmode="decimal" value="${c.amount}" />
          <label>Due day</label><input data-com="${i}" data-field="dueDay" type="number" min="1" max="31" value="${c.dueDay}" />
          <label style="display:flex;gap:8px;align-items:center;margin-top:10px">
            <input type="checkbox" data-com="${i}" data-field="essential" style="width:auto" ${c.essential ? "checked" : ""} /> Essential — protected first
          </label>
        </div>`).join("")}
      <button class="wide ghost" id="ob-add-com" style="margin-top:10px">+ Add another commitment</button>
    `, {
      skipLabel: "Add later",
      onSkip: () => { state.obStep = 3; render(); },
      onNext: async () => {
        $app.querySelectorAll("[data-com]").forEach((el) => {
          const i = Number(el.dataset.com);
          const f = el.dataset.field;
          ob.commitments[i][f] = f === "essential" ? el.checked : f === "name" ? el.value : Number(el.value);
        });
        const valid = ob.commitments.filter((c) => c.name && c.amount >= 0);
        if (valid.length > 0) {
          state.profile = await api("/v1/profile", { method: "PUT", body: JSON.stringify({
            commitments: valid.map((c) => ({ name: c.name, expectedAmount: c.amount, essential: c.essential, cadence: "monthly", dueDay: c.dueDay || undefined })),
          })});
        }
        state.obStep = 3; render();
      },
    });
  }

  if (step === 3) { // Lifestyle
    return obShell("Everyday spending", "How your flexible money is usually split. Adjust the weights — they don’t need to be exact.", `
      ${state.profile.categories.map((c, i) => `
        <label>${esc(c.name)} <small style="color:var(--text-dim)">(weight ${c.baselineWeight})</small></label>
        <input data-cat="${i}" type="number" min="0" max="20" step="0.5" value="${c.baselineWeight}" />
      `).join("")}
      <div class="note">Bigger weight = bigger share of flexible money. You can rename or add categories anytime.</div>
    `, {
      skipLabel: "Use defaults",
      onSkip: () => { state.obStep = 4; render(); },
      onNext: async () => {
        const weights = [...$app.querySelectorAll("[data-cat]")].map((el) => Number(el.value) || 0.5);
        const categories = state.profile.categories.map((c, i) => ({ id: c.id, name: c.name, baselineWeight: weights[i], floor: c.floorMinor ? c.floorMinor / 100 : undefined }));
        state.profile = await api("/v1/profile", { method: "PUT", body: JSON.stringify({ categories }) });
        state.obStep = 4; render();
      },
    });
  }

  if (step === 4) { // Safety
    return obShell("Financial safety", "Emergency savings today, and where you want them to be. No judgment.", `
      <label>Emergency savings now (${esc(state.profile.currency)})</label>
      <input id="ob-em-cur" type="number" min="0" inputmode="decimal" value="${ob.emergency.current}" placeholder="0 is fine" />
      <label>Target (${esc(state.profile.currency)})</label>
      <input id="ob-em-target" type="number" min="0" inputmode="decimal" value="${ob.emergency.target}" placeholder="e.g. 3 months of essentials" />
      <div class="note">A common target is 3–6 months of essential costs — pick what lets you sleep at night.</div>
    `, {
      skipLabel: "Skip",
      onSkip: () => { state.obStep = 5; render(); },
      onNext: async () => {
        ob.emergency = { current: Number(document.getElementById("ob-em-cur").value || 0), target: Number(document.getElementById("ob-em-target").value || 0) };
        state.profile = await api("/v1/profile", { method: "PUT", body: JSON.stringify({ emergency: ob.emergency }) });
        state.obStep = 5; render();
      },
    });
  }

  if (step === 5) { // Goals
    return obShell("Goals", "What’s next for you? A car, a wedding, travel, a home deposit.", `
      ${ob.goals.map((g, i) => `
        <div style="border-top:1px solid var(--border);padding-top:8px;margin-top:8px">
          <label>Goal</label><input data-goal="${i}" data-field="name" value="${esc(g.name)}" placeholder="Car fund…" />
          <label>Target amount (${esc(state.profile.currency)})</label><input data-goal="${i}" data-field="target" type="number" min="0" value="${g.target}" />
          <label>Target date (optional)</label><input data-goal="${i}" data-field="date" type="month" value="${g.date}" />
        </div>`).join("")}
      <button class="wide ghost" id="ob-add-goal" style="margin-top:10px">+ Add another goal</button>
    `, {
      skipLabel: "No goals yet",
      onSkip: () => { state.obStep = 6; render(); },
      onNext: async () => {
        $app.querySelectorAll("[data-goal]").forEach((el) => {
          const i = Number(el.dataset.goal);
          const f = el.dataset.field;
          ob.goals[i][f] = f === "name" || f === "date" ? el.value : Number(el.value);
        });
        for (const g of ob.goals) {
          if (g.name && g.target > 0) {
            await api("/v1/goals", { method: "POST", body: JSON.stringify({ name: g.name, targetAmount: g.target, targetDate: g.date || undefined, priority: 1 }) });
          }
        }
        state.obStep = 6; render();
      },
    });
  }

  if (step === 6) { // Preferences
    return obShell("Planning style", "How should the plan treat savings?", `
      <div class="pill-row" id="ob-styles">
        ${["conservative", "balanced", "ambitious"].map((s) => `<span class="pill" data-style="${s}" style="cursor:pointer;${s === ob.savingsStyle ? "color:var(--accent);border-color:var(--accent)" : ""}">${s}</span>`).join("")}
      </div>
      <label>Monthly buffer (% of income kept aside)</label>
      <input id="ob-buffer" type="number" min="0" max="40" value="${ob.bufferPct}" />
      <div class="note">The buffer absorbs surprise costs so goals survive a rough month.</div>
    `, {
      nextLabel: "Build my plan",
      onNext: async () => {
        state.profile = await api("/v1/profile", { method: "PUT", body: JSON.stringify({
          preferences: { savingsStyle: ob.savingsStyle, buffer: { kind: "percent_of_income", value: Number(document.getElementById("ob-buffer").value || 5) } },
        })});
        await finishOnboarding();
      },
    });
  }
}

function obError(message) {
  const box = document.getElementById("ob-error");
  box.innerHTML = `<div class="warnbox">${esc(message)}</div>`;
}

async function finishOnboarding() {
  obShell("Building your first plan…", "Protecting essentials first, then safety, goals and flexible spending.", `<div class="note">Deterministic engine v1 — every number is reproducible.</div>`, { nextLabel: "…" , onNext: () => {} });
  document.getElementById("ob-next").disabled = true;
  try {
    await api("/v1/month-plans/generate", { method: "POST" });
    state.ob = null; state.obStep = 0;
    go("plan");
  } catch (e) {
    obError(e.message);
  }
}

// Delegated live-binding for onboarding controls
document.addEventListener("click", (e) => {
  const stylePill = e.target.closest?.("[data-style]");
  if (stylePill && document.getElementById("ob-styles")) {
    obDraft().savingsStyle = stylePill.dataset.style;
    $app.querySelectorAll("#ob-styles .pill").forEach((p) => {
      p.style.color = p === stylePill ? "var(--accent)" : "";
      p.style.borderColor = p === stylePill ? "var(--accent)" : "";
    });
  }
  if (e.target.id === "ob-add-income") { obDraft().income.push({ name: "", amount: "", payday: 1, reliability: "stable" }); render(); }
  if (e.target.id === "ob-add-com") { obDraft().commitments.push({ name: "", amount: "", dueDay: 1, essential: true }); render(); }
  if (e.target.id === "ob-add-goal") { obDraft().goals.push({ name: "", target: "", date: "" }); render(); }
});

// ---------- trial banner ----------
function trialBanner() {
  const b = state.billing;
  if (!b || b.state === "active") return "";
  if (b.state === "trialing") {
    return `<div class="card notice-trial"><div><span class="badge">Trial · ${b.daysRemaining} day${b.daysRemaining === 1 ? "" : "s"} left</span>
      <div class="note" style="margin-top:6px">Full access until ${new Date(b.trialEndsAt).toLocaleDateString()}. Then a subscription keeps everything alive — your data stays yours.</div></div>
      <button class="primary" data-action="subscribe">Keep it</button></div>`;
  }
  return `<div class="card notice-trial"><div><span class="badge red">Trial ended</span>
    <div class="note" style="margin-top:6px">Your data is preserved. Subscribe to continue planning.</div></div>
    <button class="primary" data-action="subscribe">Subscribe</button></div>`;
}

// ---------- home ----------
async function renderHome() {
  const [sts, goals] = await Promise.all([api("/v1/safe-to-spend"), api("/v1/goals")]);
  const profile = state.profile;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const available = sts.availableNow?.amountMinor ?? 0;
  const cur = sts.currency ?? profile.currency;
  const estimated = sts.estimated === true;

  $app.innerHTML = `
    <h1>${greeting}</h1>
    <div class="sub">${estimated ? "Estimated view — approve this month’s plan for exact numbers" : monthName(sts.period)} · ${esc(cur)}</div>
    ${trialBanner()}
    <div class="card hero">
      <h2>Safe to spend</h2>
      <div class="amount num ${available === 0 ? "zero" : ""}">${fmt(available, cur)}</div>
      <div class="perday num">≈ ${fmt(sts.dailyRecommended?.amountMinor ?? 0, cur)}/day for the next ${sts.daysRemaining ?? "—"} days</div>
      ${estimated ? "" : `<div class="pill-row">
        <span class="pill">Flexible left ${fmt(sts.breakdown.flexibleRemaining.amountMinor, cur)}</span>
        <span class="pill">Reserved for bills ${fmt(sts.breakdown.reservedForUpcomingObligations.amountMinor, cur)}</span>
        ${sts.breakdown.overspend.amountMinor > 0 ? `<span class="pill" style="color:var(--red)">Overspent ${fmt(sts.breakdown.overspend.amountMinor, cur)}</span>` : ""}
      </div>`}
      ${estimated ? `<div class="note">${esc(sts.note ?? "")}</div>` : ""}
    </div>
    <div class="card"><h2>This month</h2><div id="home-summary" class="sub">Loading…</div></div>
    ${goals.length ? `<div class="card"><h2>Goals</h2>${goals.map((g) => {
      const pct = Math.min(100, Math.round((g.savedAmountMinor / Math.max(1, g.targetAmountMinor)) * 100));
      return `<div class="row"><div class="label">${esc(g.name)}<small>${pct}% · ${fmt(g.monthlyPlannedMinor, cur)}/mo planned ${g.projection?.onTrack === false ? "· behind pace" : ""}</small></div>
        <div class="value num">${fmt(g.savedAmountMinor, cur)}</div></div>
        <div class="bar"><span style="width:${pct}%"></span></div>`;
    }).join("")}</div>` : ""}
    <div class="actions">
      <button data-action="go-transactions">+ Add expense</button>
      <button data-action="go-plan">View plan</button>
      <button data-action="go-insights">Insights</button>
    </div>
    <div id="chatbox"></div>`;
  bindHomeActions();
  loadHomeSummary();
}

async function loadHomeSummary() {
  try {
    const insights = await api("/v1/insights/monthly");
    const cur = insights.currency;
    const bits = [];
    if (insights.emergency) {
      bits.push(`<div class="row"><div class="label">Emergency fund<small>${insights.emergency.essentialsCoverageMonths} months of essentials covered</small></div>
        <div class="value num">${insights.emergency.progressPercent}%</div></div>`);
    }
    if (insights.overspending?.length) {
      const o = insights.overspending[0];
      bits.push(`<div class="insight" style="margin-top:10px">${esc(o.name)} is trending ${o.percentUsed > 100 ? "over" : "close to"} target (${o.percentUsed}% used). Small trims now protect the rest of the month.</div>`);
    }
    document.getElementById("home-summary").innerHTML = bits.join("") || "Set up your profile to see the month at a glance.";
  } catch { /* keep placeholder */ }
}

function bindHomeActions() {
  $app.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const map = { "go-transactions": "transactions", "go-plan": "plan", "go-insights": "insights" };
      const action = btn.dataset.action;
      if (map[action]) go(map[action]);
      if (action === "subscribe") subscribe();
    });
  });
  if (document.getElementById("btn-ask")) bindChat();
}

function subscribe() {
  api("/v1/billing/checkout", { method: "POST", body: JSON.stringify({ planId: "pro-monthly" }) })
    .then(async (b) => { state.billing = b; render(); })
    .catch((e) => alert(e.message));
}

// ---------- plan ----------
async function renderPlan() {
  let plan = await api("/v1/month-plans/current");
  let isNext = false;
  if (!plan) {
    plan = await api("/v1/month-plans/latest"); // e.g. next-month draft after a rollover
    isNext = plan != null;
  }
  const cur = state.profile.currency;
  if (!plan) {
    $app.innerHTML = `
      <h1>Salary Plan</h1>
      <div class="card hero"><h2>No plan yet</h2>
        <p class="sub">Generate your first plan — obligations protected first, then savings, goals and flexible spending.</p>
        <button class="primary wide" id="btn-gen">Generate this month’s plan</button>
      </div>
      <div id="plan-error"></div>`;
    document.getElementById("btn-gen").onclick = async () => {
      try { await api("/v1/month-plans/generate", { method: "POST" }); renderPlan(); }
      catch (e) { document.getElementById("plan-error").innerHTML = `<div class="warnbox">${esc(e.message)}</div>`; }
    };
    return;
  }
  const t = plan.totals;
  const canApprove = plan.status === "draft";
  $app.innerHTML = `
    <h1>Salary Plan</h1>
    <div class="sub">${monthName(plan.period)}${isNext ? " · <strong>next month</strong>" : ""} · <span class="badge ${plan.status === "approved" ? "" : "warn"}">${plan.status}</span> · engine v${esc(plan.calculationVersion)}</div>
    ${(plan.warnings ?? []).map((w) => `<div class="warnbox">${esc(w.message)}</div>`).join("")}
    ${(plan.adaptations ?? []).length ? `<div class="card"><h2>Learned from last month</h2>${plan.adaptations.map((a) => `
      <div class="row"><div class="label">${esc(a.name)}${a.material ? ' <span class="badge warn">notable</span>' : ""}<small>${esc(a.reason)}</small></div>
      <div class="value num">${a.fromWeight} → ${a.toWeight}</div></div>`).join("")}</div>` : ""}
    <div class="card"><h2>Income</h2>
      <div class="row"><div class="label">Expected take-home</div><div class="value num">${fmt(t.income.amountMinor, cur)}</div></div>
    </div>
    <div class="card"><h2>Protected money</h2>
      ${plan.allocations.obligations.map((o) => `<div class="row"><div class="label">${esc(o.name)}${o.dueDay ? `<small>due day ${o.dueDay}</small>` : ""}</div><div class="value num">${fmt(o.amount.amountMinor, cur)}</div></div>`).join("") || `<div class="note">No essential commitments captured yet.</div>`}
      <div class="row"><div class="label"><strong>Protected total</strong></div><div class="value num">${fmt(t.protected.amountMinor, cur)}</div></div>
    </div>
    <div class="card"><h2>Future money</h2>
      <div class="row"><div class="label">Emergency fund</div><div class="value num">${fmt(t.emergency.amountMinor, cur)}</div></div>
      ${plan.allocations.goals.map((g) => `<div class="row"><div class="label">${esc(g.name)}<small>priority ${g.priority}${g.requiredMonthlyPaceMinor ? ` · pace ${fmt(g.requiredMonthlyPaceMinor, cur)}/mo` : ""}</small></div><div class="value num ${g.planned.amountMinor === 0 ? "dim" : ""}">${fmt(g.planned.amountMinor, cur)}</div></div>`).join("")}
      <div class="row"><div class="label">Buffer</div><div class="value num">${fmt(t.buffer.amountMinor, cur)}</div></div>
    </div>
    <div class="card"><h2>Life spending</h2>
      ${plan.allocations.flexible.map((f) => `<div class="row"><div class="label">${esc(f.name)}</div><div class="value num">${fmt(f.planned.amountMinor, cur)}</div></div>`).join("")}
      <div class="row"><div class="label"><strong>Flexible total</strong></div><div class="value num">${fmt(t.flexible.amountMinor, cur)}</div></div>
    </div>
    ${canApprove ? `<button class="primary wide" id="btn-approve">${isNext ? `Approve ${monthName(plan.period)} plan` : "Approve plan"}</button>` : `<div class="note">Approved ${plan.approvedAt ? new Date(plan.approvedAt).toLocaleString() : ""}. Regenerate to see updated numbers.</div>`}
    <button class="wide ghost" id="btn-regen">Regenerate plan</button>`;
  if (document.getElementById("btn-approve")) {
    document.getElementById("btn-approve").onclick = async () => {
      await api(`/v1/month-plans/${plan.id}/approve`, { method: "POST" });
      await loadAccount(); renderPlan();
    };
  }
  document.getElementById("btn-regen").onclick = async () => {
    await api("/v1/month-plans/generate", { method: "POST" }); renderPlan();
  };
}

// ---------- transactions ----------
async function renderTransactions() {
  const [txns, profile] = await Promise.all([api("/v1/transactions?limit=60"), api("/v1/profile")]);
  state.profile = profile;
  const cur = profile.currency;
  const catName = (id) => profile.categories.find((c) => c.id === id)?.name ?? "Uncategorized";
  $app.innerHTML = `
    <h1>Spending</h1>
    <div class="card"><h2>Quick add</h2>
      <input id="tx-text" placeholder="e.g. Spent 950 on dinner · Aaj petrol pe 3000 kharch hua" />
      <button class="primary wide" id="tx-parse">Preview</button>
      <div id="tx-draft"></div>
    </div>
    <div class="card"><h2>Import CSV</h2>
      <input type="file" id="csv-file" accept=".csv,text/csv,text/plain" style="padding:8px" />
      <label>…or paste rows (date, amount, description)</label>
      <textarea id="csv-text" rows="4" placeholder="2026-09-01,1250,Grocery run&#10;02/09/2026,800,Petrol" style="width:100%;font:inherit;background:var(--surface-2);color:var(--text);border:1px solid var(--border);border-radius:12px"></textarea>
      <button class="wide" id="csv-import">Import</button>
      <div id="csv-result"></div>
    </div>
    <div class="card"><h2>Recent</h2>
      ${txns.length === 0 ? `<div class="note">No transactions yet — add your first one above.</div>` : txns.map((t) => `
        <div class="row"><div class="label">${esc(t.merchant)}<small>${esc(catName(t.categoryId))} · ${t.date} · ${t.source}</small></div>
        <div class="value num neg">−${fmt(t.amount.amountMinor, t.amount.currency)}</div></div>`).join("")}
    </div>`;
  document.getElementById("tx-parse").onclick = async () => {
    const text = document.getElementById("tx-text").value.trim();
    if (!text) return;
    const draft = await api("/v1/transactions/parse", { method: "POST", body: JSON.stringify({ text }) });
    if (draft.amountMajor == null) {
      document.getElementById("tx-draft").innerHTML = `<div class="warnbox">Couldn’t find an amount in that. Try “Spent 950 on dinner”.</div>`;
      return;
    }
    const minor = Math.round(draft.amountMajor * 100);
    document.getElementById("tx-draft").innerHTML = `
      <div class="row"><div class="label">${esc(draft.merchantGuess)}<small>${esc(draft.notes.join(" · ") || "looks good")} · confidence ${Math.round(draft.confidence * 100)}%</small></div>
      <div class="value num">−${fmt(minor, cur)}</div></div>
      <button class="primary wide" id="tx-save">Save transaction</button>`;
    document.getElementById("tx-save").onclick = async () => {
      await api("/v1/transactions", {
        method: "POST",
        body: JSON.stringify({
          amount: draft.amountMajor,
          merchant: draft.merchantGuess,
          categoryId: draft.categoryId ?? undefined,
          source: "text",
          confidence: draft.confidence,
        }),
      });
      renderTransactions();
    };
  };
  document.getElementById("csv-file").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) file.text().then((t) => { document.getElementById("csv-text").value = t; });
  });
  document.getElementById("csv-import").onclick = async () => {
    const csv = document.getElementById("csv-text").value.trim();
    if (!csv) return;
    try {
      const result = await api("/v1/imports/csv", { method: "POST", body: JSON.stringify({ csv }) });
      document.getElementById("csv-result").innerHTML = `
        <div class="note" style="margin-top:10px">✅ Imported ${result.created.length} · duplicates skipped: ${result.duplicates.length} · errors: ${result.errors.length}</div>
        ${result.duplicates.map((d) => `<div class="warnbox">Row ${d.row}: ${esc(d.reason)}</div>`).join("")}
        ${result.errors.map((er) => `<div class="warnbox">Row ${er.row}: ${esc(er.message)}</div>`).join("")}`;
      if (result.created.length > 0) setTimeout(() => renderTransactions(), 1200);
    } catch (e) {
      document.getElementById("csv-result").innerHTML = `<div class="warnbox">${esc(e.message)}</div>`;
    }
  };
}

// ---------- insights ----------
async function renderInsights() {
  const [insights, monthEnd] = await Promise.all([api("/v1/insights/monthly"), api("/v1/insights/month-end")]);
  const cur = insights.currency;
  $app.innerHTML = `
    <h1>Insights</h1>
    <div class="sub">${monthName(insights.period)} · ${insights.transactionCount} transactions · engine v${esc(insights.emergency.calculationVersion)}</div>
    <div class="card"><h2>Month-end review</h2>
      <div id="month-end">
        ${monthEnd.ready
          ? `<div class="note">I compared ${monthEnd.evidence.categorizedInPeriod} categorized transactions against your plan. Proposed adjustments for ${monthEnd.nextPeriod ? monthName(monthEnd.nextPeriod) : "next month"}:</div>
             ${monthEnd.proposals.map((p) => `<div class="row"><div class="label">${esc(p.name)}${p.material ? ' <span class="badge warn">notable</span>' : ""}<small>${esc(p.reason)}</small></div>
               <div class="value num">${p.fromWeight} → ${p.toWeight}</div></div>`).join("")}
             <button class="primary wide" id="btn-rollover">Plan ${monthEnd.nextPeriod ? monthName(monthEnd.nextPeriod) : "next month"} with these adjustments</button>`
          : `<div class="note">${esc(monthEnd.reason ?? "Keep recording spending — the plan adapts when there is enough evidence.")}</div>`}
      </div>
    </div>
    <div class="card"><h2>Emergency fund</h2>
      <div class="bar"><span class="${insights.emergency.progressPercent >= 100 ? "" : "warn"}" style="width:${Math.min(100, insights.emergency.progressPercent)}%"></span></div>
      <div class="row"><div class="label">Progress<small>${insights.emergency.essentialsCoverageMonths} months of essentials covered</small></div>
      <div class="value num">${fmt(insights.emergency.current.amountMinor, cur)} / ${fmt(insights.emergency.target.amountMinor, cur)}</div></div>
      ${insights.emergency.monthlyContribution.amountMinor > 0 ? `<div class="note">This month’s plan adds ${fmt(insights.emergency.monthlyContribution.amountMinor, cur)}.</div>` : ""}
    </div>
    <div class="card"><h2>Budget vs actual</h2>
      ${insights.variance ? insights.variance.lines.map((l) => `
        <div class="row"><div class="label">${esc(l.name)}<small>${l.percentUsed}% used</small></div>
        <div class="value num ${l.status === "over" ? "neg" : l.status === "on_track" ? "pos" : "dim"}">${fmt(l.actual.amountMinor, cur)} <span class="dim">/ ${fmt(l.planned.amountMinor, cur)}</span></div></div>`).join("")
      : `<div class="note">Approve a plan to compare against it.</div>`}
    </div>
    <div class="card"><h2>Recurring costs</h2>
      <div class="row"><div class="label">Expected this month<small>range ${fmt(insights.recurring.totalRange.low.amountMinor, cur)} – ${fmt(insights.recurring.totalRange.high.amountMinor, cur)}</small></div>
      <div class="value num">${fmt(insights.recurring.totalExpected.amountMinor, cur)}</div></div>
      ${insights.recurring.lines.filter((l) => l.confidence < 1).map((l) => `<div class="note">${esc(l.name)}: uncertain (range ${fmt(l.range.low.amountMinor, cur)}–${fmt(l.range.high.amountMinor, cur)}). Confirm it to raise confidence.</div>`).join("")}
    </div>
    <div class="card"><h2>Ask your assistant</h2><div id="chatbox"></div></div>`;
  bindChat();
  const btn = document.getElementById("btn-rollover");
  if (btn) {
    btn.onclick = async () => {
      btn.disabled = true; btn.textContent = "Planning…";
      const result = await api("/v1/month-plans/rollover", { method: "POST", body: JSON.stringify({}) });
      btn.textContent = `Draft plan for ${monthName(result.plan.period)} created ✓ — opening…`;
      setTimeout(() => go("plan"), 900);
    };
  }
}

// ---------- profile ----------
async function renderProfile() {
  const profile = await api("/v1/profile");
  state.profile = profile;
  const p = profile.preferences;
  $app.innerHTML = `
    <h1>Profile</h1>
    <div class="card"><h2>Trial & billing</h2>${trialBanner() || `<div class="note">Subscription active — thanks for supporting the product.</div>`}</div>
    <div class="card"><h2>World settings</h2>
      <label>Currency</label>
      <select id="pf-cur">${["USD", "PKR", "EUR", "GBP", "INR", "AED", "SAR", "JPY", "CAD", "AUD"].map((c) => `<option ${c === profile.currency ? "selected" : ""}>${c}</option>`).join("")}</select>
      <label>Timezone</label>
      <select id="pf-tz">${["UTC", "Asia/Karachi", "Asia/Dubai", "Asia/Kolkata", "Europe/London", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Los_Angeles", "Asia/Tokyo", "Australia/Sydney"].map((z) => `<option ${z === profile.locale.timezone ? "selected" : ""}>${z}</option>`).join("")}</select>
      <label>Language</label>
      <select id="pf-lang">${["en", "ur-PK", "ar", "hi", "tr", "fr", "es"].map((l) => `<option ${l === profile.locale.language ? "selected" : ""}>${l}</option>`).join("")}</select>
      <button class="wide" id="pf-save">Save settings</button>
    </div>
    <div class="card"><h2>Savings style</h2>
      <div class="pill-row">${["conservative", "balanced", "ambitious"].map((s) => `<span class="pill" data-pfstyle="${s}" style="cursor:pointer;${s === p.savingsStyle ? "color:var(--accent);border-color:var(--accent)" : ""}">${s}</span>`).join("")}</div>
      <div class="note">Plans adapt gradually — no wild swings from one unusual month.</div>
    </div>
    <div class="card"><h2>Your data</h2>
      <button class="wide" id="pf-export">Export my data (JSON)</button>
      <button class="wide ghost" id="pf-logout" style="color:var(--red)">Sign out</button>
    </div>`;
  document.getElementById("pf-save").onclick = async () => {
    state.profile = await api("/v1/profile/locale", {
      method: "PATCH",
      body: JSON.stringify({
        currency: document.getElementById("pf-cur").value,
        locale: {
          countryCode: profile.locale.countryCode,
          language: document.getElementById("pf-lang").value,
          timezone: document.getElementById("pf-tz").value,
          weekStart: profile.locale.weekStart,
        },
      }),
    });
    renderProfile();
  };
  $app.querySelectorAll("[data-pfstyle]").forEach((el) => el.addEventListener("click", async () => {
    state.profile = await api("/v1/profile", { method: "PUT", body: JSON.stringify({ preferences: { savingsStyle: el.dataset.pfstyle } }) });
    renderProfile();
  }));
  document.getElementById("pf-export").onclick = async () => {
    const data = await api("/v1/profile/export");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "salary-ai-export.json"; a.click();
  };
  document.getElementById("pf-logout").onclick = () => logout(true);
}

function logout(clear) {
  if (clear) api("/v1/auth/logout", { method: "POST" }).catch(() => {});
  state.token = null; state.profile = null; state.ob = null; state.obStep = 0;
  localStorage.removeItem("token");
  go("home");
}

// ---------- assistant chat ----------
function bindChat() {
  const box = document.getElementById("chatbox");
  if (!box) return;
  const log = state.chat.map((m) => `<div class="msg ${m.role === "user" ? "user" : "ai"}">${esc(m.text)}${m.meta ? `<div class="meta">${esc(m.meta)}</div>` : ""}</div>`).join("");
  box.innerHTML = `
    <div class="chatlog" id="chat-log">${log}</div>
    <input id="chat-in" placeholder="Ask: Can I spend 5000 on shoes?" />
    <button class="primary wide" id="chat-send">Ask</button>`;
  document.getElementById("chat-send").onclick = sendChat;
  document.getElementById("chat-in").addEventListener("keydown", (e) => { if (e.key === "Enter") sendChat(); });
}
async function sendChat() {
  const input = document.getElementById("chat-in");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  state.chat.push({ role: "user", text });
  bindChat();
  try {
    const session = state.chatSession ?? (state.chatSession = (await api("/v1/ai/sessions", { method: "POST" })).id);
    const res = await api(`/v1/ai/sessions/${session}/messages`, { method: "POST", body: JSON.stringify({ text }) });
    state.chat.push({ role: "ai", text: res.reply, meta: `${res.provider} · grounded in ${res.recommendation.calculation_id} · ${res.toolCalls.length} tool call${res.toolCalls.length === 1 ? "" : "s"}` });
  } catch (e) {
    state.chat.push({ role: "ai", text: e.message });
  }
  bindChat();
}

// ---------- boot ----------
(async function boot() {
  window.addEventListener("hashchange", render);
  if (state.token) {
    try { await loadAccount(); } catch { state.token = null; }
  }
  render();
})();
