# Deploying Salary AI — backend + real AI + store builds

Everything below is copy-paste runnable. Total hands-on time: ~45 minutes
plus app-store review waits. What runs where:

```
┌──────────────┐        ┌────────────────────────┐       ┌─────────────┐
│ Phone app    │ ─────▶ │ API on Render/Railway  │ ────▶ │ LLM provider│
│ (Expo build) │ HTTPS  │ engine · auth · billing│  key  │ (optional)  │
└──────────────┘        │ disk volume = data     │       └─────────────┘
                        └────────────────────────┘
```

- The **engine never runs on the phone** — money math stays deterministic and
  server-side, exactly like the web client.
- The **AI key never ships in the app** — it lives in server env vars only.
- Persistence for pilots: JSON snapshots to an attached disk (`DATA_DIR`).
  The Postgres swap (`infra/migrations/000_init.sql`) is the documented next
  step for scale; interfaces are already shaped for it.

---

## 1. Deploy the backend (~10 min, Render)

1. Create a free [Render](https://render.com) account → **New → Blueprint**
   → connect this GitHub repo → pick branch
   `arena/01a0934e-salary-ai-management` → Render reads `infra/render.yaml`
   → **Apply**.
   - Manual equivalent: New → Web Service → Docker → dockerfilePath
     `./infra/Dockerfile`, instance **Starter** (needs a persistent disk —
     the free tier doesn't support disks), add a 1 GB disk mounted at
     `/data`, env `DATA_DIR=/data`.
2. Note the service URL, e.g. `https://salary-ai-api.onrender.com`.
3. Verify: open `https://<your-url>/health` → `{"ok":true,...}`. The web
   demo also serves at the root `/` — register a test user there, then
   **Manual Restart** the service and log in again: the account survives
   (snapshot persistence working).

### Railway / Fly / any Docker host

Any platform that runs the repo-root Dockerfile works. The two rules:
bind port from `$PORT` (already handled — default 3000, override `PORT`
env), and give the container a writable mount + `DATA_DIR` pointing at it.

## 2. Turn the AI on (~5 min)

The assistant ships with a deterministic grounded fallback (works with no
key). To get the full LLM upgrade:

1. Get an API key from any OpenAI-compatible provider (OpenAI, Groq,
   OpenRouter, Together…). For OpenAI: platform.openai.com → API keys.
2. On Render → your service → **Environment**, set:
   - `AI_BASE_URL` = `https://api.openai.com/v1` (or your provider's URL)
   - `AI_API_KEY` = `sk-…`  ← **never** put this in the mobile app
   - `AI_MODEL` = e.g. `gpt-4o-mini`
3. Save → service redeploys → in the app, ask the assistant something like
   "can I spend 5000 on shoes?" — the reply is grounded in your
   safe-to-spend numbers via the 10-tool contract; every answer cites its
   calculation id.

Cost note: `gpt-4o-mini`-class models cost fractions of a cent per
conversation; a $5 key covers thousands of user chats.

## 3. Google Play (~30 min + review)

1. One-time $25: play.google.com/console → create developer account.
2. EAS builds the Android app in the cloud (no Android Studio needed):
   ```bash
   cd apps/mobile && npm i -g eas-cli && eas login && eas init
   # edit src/config.ts → API_URL = "https://<your-render-url>"
   eas build -p android --profile production      # → .aab, ~20 min
   ```
3. Play Console → **Create app** → fill listing with
   `docs/store-listing.md` copy → upload the `.aab` (Internal testing first)
   → complete the Data safety form (answers in `docs/store-listing.md`) →
   Privacy policy URL (section 5 below) → submit for review.
4. After Play approves: `eas submit -p android` or manual upload to promote
   the release to Production.

## 4. Apple App Store (~40 min + review)

1. One-time $99/yr: developer.apple.com → enroll (needs ID verification).
2. `eas build -p ios --profile production` → EAS builds on Mac hardware.
3. appstoreconnect.apple.com → My Apps → **+** → New App → paste the copy
   from `docs/store-listing.md` (iOS column) → upload the build via
   `eas submit -p ios` → fill App Privacy (answers in the same file) →
   Privacy policy URL → submit.
4. Apple reviews usually take 24–48 h; common rejection reasons for this
   category are incomplete privacy answers and demo-account absence — use
   the seeded demo user as the reviewer account (Create a demo user with
   `apps/api/src/demoSeed.ts` data via the web client, share credentials
   in the review notes).

## 5. Privacy policy URL (both stores)

A ready-to-ship policy lives at `docs/privacy-policy.html`. Serve it free
via GitHub Pages:

1. Repo → Settings → Pages → **Deploy from a branch** → this branch →
   folder `/docs` → Save.
2. Policy URL = `https://malik-soban-dev.github.io/salary-ai-management/privacy-policy.html`
   (the demo at `/index.html` uses the same Pages site).
3. Read it once and adjust the contact email before submitting.

## 6. Mobile app config checklist

| What | Where | Value |
|---|---|---|
| API URL | `apps/mobile/src/config.ts` | your Render URL (https) |
| EAS project | `apps/mobile/app.json` | `eas init` fills it |
| Version | `apps/mobile/app.json` | bump per store release |
| AI key | server env only | never in the app bundle |

## 7. Scaling path (when pilots become users)

1. Swap `store.ts` Maps for the Postgres repository per
   `infra/migrations/000_init.sql` (interfaces already match; add RLS).
2. Move snapshots → real migrations; drop `DATA_DIR`.
3. Add real store billing: `play_store` / `app_store` providers are already
   modeled in `SubscriptionRecord`; wire purchase verification into
   `platform.ts` (Stripe stays the web path).
