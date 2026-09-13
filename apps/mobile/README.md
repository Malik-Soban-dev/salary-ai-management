# Salary AI — mobile app (Expo / React Native)

One codebase → Android (Play Store) and iOS (App Store). Talks to the same
Salary AI API as the web client; the finance engine stays server-side, so
store builds stay thin and every calculation remains reproducible.

## Run locally

```bash
cd apps/mobile
npm install
# point the app at your API (see src/config.ts):
#   emulator:  http://10.0.2.2:3000  (Android) / http://localhost:3000
#   phone:     http://<your-LAN-IP>:3000
npx expo start
```

## Store builds (EAS cloud build — no Mac required)

```bash
npm i -g eas-cli
eas login                      # your Expo account (free)
eas init                       # fills the projectId in app.json
eas build -p android --profile production   # → .aab for Google Play
eas build -p ios --profile production       # → .ipa for App Store Connect
eas submit -p android          # after your Play Console app is created
eas submit -p ios              # after your App Store Connect app exists
```

## Before a store build

1. `src/config.ts` → set `API_URL` to your **deployed backend** (see
   `infra/` for deployment configs).
2. `app.json` → replace the EAS `projectId` placeholder (`eas init` does it).
3. Store assets: privacy policy URL (template in `docs/`), screenshots
   (capture from a device/emulator), support email.
4. Accounts you need: Google Play Developer ($25 once), Apple Developer
   Program ($99/yr), an Expo account (free), and an LLM API key if you want
   the upgraded assistant (set on the server, never in the app).

## Versioning

`app.json` version + `autoIncrement` in `eas.json` handles build numbers.
Bump `version` for each store release.
