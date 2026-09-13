/**
 * Backend connection.
 *
 * Dev: set this to your machine's LAN IP so the phone/emulator can reach the
 * API (e.g. "http://192.168.1.10:3000"). Production: set to your deployed
 * backend URL before `eas build` (or use app.config extra / env).
 *
 * NOTE: the AI provider key lives ONLY on this backend. The app never holds it.
 */
export const API_URL = "http://localhost:3000";
