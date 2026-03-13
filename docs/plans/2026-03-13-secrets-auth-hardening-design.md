# Secrets, Auth, and Deployment Hardening

## Context

The app handles sensitive credentials (UniFi controller, AI API keys) and is primarily used on a homelab LAN. The current security model is lightweight: no application-level auth, AI keys stored plaintext in SQLite, and CORS hardcoded to localhost. This is fine for local-only use but insufficient when the app is exposed over the network.

The goal is to harden secrets, add an opt-in auth gate, and tighten deployment boundaries without adding friction to the default homelab experience.

## Design

### 1. Application auth gate (opt-in)

Auth activates when `APP_PASSWORD` env var is set. When absent, the app behaves exactly as today.

**Middleware:** A FastAPI middleware checks every request. If `APP_PASSWORD` is configured, it requires a valid session cookie. Excluded paths: `POST /api/auth/app-login`, `GET /api/auth/app-status`, `GET /api/health`, and static file serving.

**Login flow:**
- Frontend detects auth requirement via `GET /api/auth/app-status` which returns `{required: bool, authenticated: bool}`.
- When required and not authenticated, a passphrase screen is shown (single password field, no username).
- `POST /api/auth/app-login` accepts `{password: "..."}`, compares using `hmac.compare_digest` (constant-time).
- On match, sets an HTTP-only SameSite=Strict cookie `_session` containing `timestamp:hmac(timestamp, APP_PASSWORD)`.

**Session validation:** Middleware reads cookie, splits timestamp and signature, verifies HMAC, checks expiry against `APP_SESSION_TTL` (default 86400 seconds / 24h).

**No external dependencies.** Uses `hmac` and `hashlib` from stdlib.

**Env vars:**
- `APP_PASSWORD` -- enables auth gate when set
- `APP_SESSION_TTL` -- cookie lifetime in seconds (default: 86400)

### 2. AI key production path

No encryption at rest. SQLite storage remains as a dev/local convenience. Production deployments should use env vars or Docker secret files.

**Priority chain for AI API key:**
1. `AI_API_KEY` env var (direct)
2. `AI_API_KEY_FILE` contents (Docker secrets / Compose secret mounts)
3. SQLite database (local/dev)

**Startup warning:** When `APP_PASSWORD` is set and the database contains a plaintext AI key, log: `WARNING: AI API key stored in plaintext database. In production, use AI_API_KEY env var instead.`

**No changes to settings UI.** It continues to read/write SQLite. When the key comes from env/file, the existing `source: "env"` indicator tells the user.

### 3. CORS and deployment controls

**CORS simplification:** The production image serves frontend static files from FastAPI on the same origin -- no cross-origin requests occur. CORS middleware only activates in dev mode (when `FRONTEND_DIST_DIR` is not set, meaning Vite runs on a separate port).

**Error sanitization:**
- `UnifiApiError` handler: return generic `"Failed to communicate with UniFi controller"` to client, log full exception server-side.
- AI test endpoint: return `"Provider returned HTTP {status}"` instead of `e.response.text[:200]`, log full response server-side.

**Traefik documentation:** `docs/deployment.md` covers production Docker Compose setup with `APP_PASSWORD` and `AI_API_KEY`, Traefik reverse proxy labels (routing, TLS via Let's Encrypt, health check), Docker secrets for `AI_API_KEY_FILE`, and a note that CORS is not needed since Traefik proxies both frontend and API from the same origin.

## File changes

### New files
- `backend/app/middleware.py` -- auth gate middleware
- `frontend/src/components/PassphraseScreen.tsx` -- single-field passphrase form
- `docs/deployment.md` -- production setup, Traefik, Docker secrets
- `backend/tests/test_middleware.py` -- auth gate tests

### Modified files
- `backend/app/main.py` -- register middleware, conditional CORS, startup warning
- `backend/app/config.py` -- APP_PASSWORD, APP_SESSION_TTL, AI_API_KEY_FILE settings
- `backend/app/routers/auth.py` -- app-login and app-status endpoints
- `backend/app/services/ai_settings.py` -- file-based key reading, priority chain
- `backend/app/routers/settings.py` -- sanitize AI test error responses
- `backend/app/models.py` -- AppLoginInput, AppAuthStatus models
- `frontend/src/App.tsx` -- check app auth status, gate on passphrase screen
- `frontend/src/api/client.ts` -- appLogin, getAppAuthStatus methods
- `frontend/src/api/types.ts` -- AppAuthStatus interface
- `backend/tests/test_auth_router.py` -- app-login and app-status tests
- `backend/tests/test_ai_settings.py` -- file-based key, startup warning tests
- `backend/tests/test_settings_router.py` -- error sanitization tests

## Testing

- Auth middleware: no-op when APP_PASSWORD unset, 401 without cookie, valid cookie passes, expired cookie rejected, wrong password rejected, excluded paths bypass
- App auth endpoints: status reflects config and cookie state, login sets cookie on correct password
- AI key file: reads from file, env takes priority, missing file falls through, startup warning triggers
- Error sanitization: generic messages to client, full details in server logs
- Frontend: passphrase screen renders when required, successful login transitions to main app
