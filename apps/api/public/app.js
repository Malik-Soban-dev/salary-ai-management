/* Salary AI demo client. Talks only to same-origin /v1 endpoints. */
const $app = document.getElementById("app");
const $tabbar = document.getElementById("tabbar");

const state = {
  token: localStorage.getItem("token") ?? null,
  profile: null,
  billing: null,
  chat: [],
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
    if (res.status === 401 && state.token) { logout(false); }
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
function fmtClass(minor) { return minor < 0 ? "neg" : "pos"; }
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function monthName(p) { return new Date(Date.UTC(p.year, p.month - 1, 1)).toLocaleString("en", { month: "long", year: "numeric" }); }

function setTabbar(tabs, active) {
  $tabbar.innerHTML = tabs.map((t) => `<button data-tab="${t.id}" class="${t.id === active ? "active" : ""}">${t.icon}<br/>${t.label}</button>`).join("");
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

// ---------- views ----------
function render() {
  const route = (location.hash.replace(/^#\//, "") || "home").split("?")[0];
  if (!state.token) return renderWelcome();
  setTabbar(TABS, TABS.some((t) => t.id === route) ? route : "home");
  const views = { home: renderHome, plan: renderPlan, transactions: renderTransactions, insights: renderInsights, profile: renderProfile };
  (views[route] ?? renderHome)();
}

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
        <select id="in-cur">
          ${["USD", "PKR", "EUR", "GBP", "INR", "AED", "SAR", "JPY", "CAD", "AUD"].map((c) => `<option>${c}</option>`).join("")}
        </select>
        <button class="wide" id="btn-register">Create account</button>
        <div id="auth-error" class="warnbox hidden"></div>
      </div>
    </div>`;
  document.getElementById("btn-demo").onclick = async () => {
    const seeded = await api("/v1/demo/seed", { method: "POST" });
    state.token = seeded.token;
    localStorage.setItem("token", seeded.token);
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
      await loadAccount(); go("home");
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

async function renderHome() {
  const [sts, goals] = await Promise.all([api("/v1/safe-to-spend"), api("/v1/goals")]);
  const profile = state.profile;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const available = sts.availableNow?.amountMinor ?? 0;
  const cur = sts.currency ?? profile.currency;
  const estimated = sts.estimated === true;

  $app.innerHTML = `
    <h1>${greeting}, ${esc(profile.userId && state.billing?.state ? "" : "")}${esc("there")}</h1>
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

async function renderPlan() {
  const plan = await api("/v1/month-plans/current");
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
    <div class="sub">${monthName(plan.period)} · <span class="badge ${plan.status === "approved" ? "" : "warn"}">${plan.status}</span> · engine v${esc(plan.calculationVersion)}</div>
    ${plan.warnings.map((w) => `<div class="warnbox">${esc(w.message)}</div>`).join("")}
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
    ${canApprove ? `<button class="primary wide" id="btn-approve">Approve plan</button>` : `<div class="note">Approved ${plan.approvedAt ? new Date(plan.approvedAt).toLocaleString() : ""}. Regenerate to see updated numbers.</div>`}
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

async function renderTransactions() {
  const [txns, profile] = await Promise.all([api("/v1/transactions?limit=60"), api("/v1/profile")]);
  const cur = profile.currency;
  const catName = (id) => profile.categories.find((c) => c.id === id)?.name ?? "Uncategorized";
  $app.innerHTML = `
    <h1>Spending</h1>
    <div class="card"><h2>Quick add</h2>
      <input id="tx-text" placeholder="e.g. Spent 950 on dinner · Aaj petrol pe 3000 kharch hua" />
      <button class="primary wide" id="tx-parse">Preview</button>
      <div id="tx-draft"></div>
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
}

async function renderInsights() {
  const insights = await api("/v1/insights/monthly");
  const cur = insights.currency;
  $app.innerHTML = `
    <h1>Insights</h1>
    <div class="sub">${monthName(insights.period)} · ${insights.transactionCount} transactions · engine v${esc(insights.emergency.calculationVersion)}</div>
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
}

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
      <div class="pill-row">${["conservative", "balanced", "ambitious"].map((s) => `<span class="pill" data-style="${s}" style="cursor:pointer;${s === p.savingsStyle ? "color:var(--accent);border-color:var(--accent)" : ""}">${s}</span>`).join("")}</div>
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
  $app.querySelectorAll("[data-style]").forEach((el) => el.addEventListener("click", async () => {
    state.profile = await api("/v1/profile", { method: "PUT", body: JSON.stringify({ preferences: { savingsStyle: el.dataset.style } }) });
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
  state.token = null; state.profile = null;
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
    state.chat.push({ role: "ai", text: res.reply, meta: `grounded in ${res.recommendation.calculation_id} · ${res.toolCalls.length} tool call${res.toolCalls.length === 1 ? "" : "s"}` });
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
