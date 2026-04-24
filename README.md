# FireGuard Cloud

A cloud fire-risk service: point at a location, get back a fire
risk score from live MET weather run through the FRCM physics model, with a
global watched-city board precomputed in the background.

- **Live instance**: `http://158.37.63.124:5173` (frontend), `http://158.37.63.124:8000` (API)
- **Interactive docs**: `http://158.37.63.124:8000/docs`

---

## 1. Architecture (big picture)

```
                 ┌─────────────────────────────────────┐
                 │          Browser (React)            │
                 │    Leaflet map · Dashboard · SSE    │
                 └───────────────┬─────────────────────┘
                                 │ HTTP (JSON + multipart)
                                 │ SSE  (text/event-stream)
                                 ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                   FastAPI  backend  (Docker)                │
 │  ┌───────────────┐  ┌──────────────┐  ┌─────────────────┐   │
 │  │ Auth          │  │  Scheduler   │  │  SSE broadcast  │   │
 │  │ middleware    │  │  (APSchedr.) │  │  (asyncio Queue)│   │
 │  └───────┬───────┘  └──────┬───────┘  └────────┬────────┘   │
 │          │                 │                   │            │
 │          ▼                 ▼                   ▼            │
 │  ┌─────────────────────────────────────────────────────┐    │
 │  │ compute_and_store_location_run()                    │    │
 │  │   ├─ fetch_forecast()  → MET Norway REST API        │    │
 │  │   ├─ run_frcm()        → dynamic-frcm-simple (git   │    │
 │  │   │                       submodule in third_party) │    │
 │  │   └─ db.commit() + broadcast()                      │    │
 │  │ bootstrap_watchlist() seeds missing cities on boot  │    │
 │  └────────────────────────┬────────────────────────────┘    │
 └───────────────────────────┼─────────────────────────────────┘
                             │ SQLAlchemy
                             ▼
                 ┌─────────────────────────────────────┐
                 │     PostgreSQL 16  (Docker)         │
                 │     tables: runs, datasets,         │
                 │             weather_records         │
                 └─────────────────────────────────────┘
```

**Shape**: monolithic backend (FastAPI) with a single-page React frontend and
a database container. Not microservices — the backend is one process with
clearly separated modules (`main`, `scheduler`, `auth`, `events`, `met_service`,
`frcm_service`, `storage`, `db`).

**Components**

| Component | Tech | Role |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind + Leaflet | SPA; dashboards, map, live event feed |
| Backend | FastAPI (Python 3.11), SQLAlchemy 2, Pydantic v2, APScheduler | REST + SSE API; background polling; FRCM integration |
| Database | PostgreSQL 16 (Docker) | Persistent storage for runs, datasets, weather snapshots |
| FRCM | `third_party/dynamic-frcm-simple` (git submodule) | Fire risk physics model |
| MET Norway | External | Live weather forecast source (Locationforecast 2.0) |
| CI/CD | GitHub Actions | Tests → Docker build → deploy to NREC via SSH |
| Host | NREC (Norwegian Research & Education Cloud) VM | Production deployment |

**Communication**

| Link | Protocol | Notes |
|---|---|---|
| Browser → Backend | HTTP/JSON + multipart | REST for auth, risk, history, datasets |
| Backend → Browser | SSE (`text/event-stream`) | Push notifications on new runs; one async queue per subscriber |
| Backend → Postgres | SQL via SQLAlchemy | Connection pooled, isolated container |
| Backend → MET Norway | HTTPS (`httpx`) | Locationforecast 2.0, 48-hour forecast |
| Backend ↔ FRCM | Python in-process | Submodule imported via `PYTHONPATH` |

**Why SSE and not MQTT/WebSocket?** Publishers are HTTP clients and the
scheduler — both server-side. Subscribers are browser tabs. SSE is one-way,
runs on plain HTTP, and EventSource is built into the browser. No broker
process to deploy, no WebSocket handshake complexity. If the system grew to
ingest field sensors, an MQTT broker would be added at that layer.

---

## 2. Running locally

### Prerequisites

- Docker Desktop (Windows/macOS) or Docker + Compose plugin (Linux)
- `git` with submodule support
- For the manual path only: Python 3.11+, Node 18+, local PostgreSQL 16

### Option A — Docker Compose (recommended, one command)

```bash
# 1. Clone with submodules
git clone --recurse-submodules https://github.com/LazarDelic22/fireguardCloud.git
cd fireguardCloud

# 2. Copy env template and fill in secrets
cp .env.example .env
# Edit .env:
#   - Set POSTGRES_PASSWORD to a random string
#   - Set FIREGUARD_API_KEY — generate with:
#       python -c "import secrets; print(secrets.token_urlsafe(32))"
#   - Set FIREGUARD_JWT_SECRET — generate with:
#       python -c "import secrets; print(secrets.token_urlsafe(48))"
#   - VITE_API_BASE_URL stays http://localhost:8000

# 3. Boot everything
docker compose up --build
```

Open:

- Frontend: http://localhost:5173
- API: http://localhost:8000
- Swagger docs: http://localhost:8000/docs

`docker compose up` waits for Postgres healthcheck before starting the backend,
which in turn boots before the frontend. When `FIREGUARD_SCHEDULER_ENABLED=true`,
the backend also seeds any missing watchlist cities once at startup so the home
page has real data immediately.

### Option B — Manual (three processes)

You'll need a local Postgres 16 running on port 5432 with a database named
`fireguard` and a user `fireguard`.

**Backend:**

```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
# macOS/Linux:
.venv/bin/pip install -r requirements.txt

# Point at FRCM submodule
$env:PYTHONPATH = "..\third_party\dynamic-frcm-simple\src"   # PowerShell
export PYTHONPATH=../third_party/dynamic-frcm-simple/src      # bash

# Env
export FIREGUARD_DATABASE_URL="postgresql+psycopg2://fireguard:password@localhost:5432/fireguard"
export FIREGUARD_AUTH_ENABLED=false      # disable auth for local dev
export FIREGUARD_SCHEDULER_ENABLED=false # disable background polls for local dev
export FIREGUARD_JWT_SECRET="dev-only-secret-change-me-if-auth-enabled"

# Run
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

SQLite is also supported for the lightest dev setup — just set
`FIREGUARD_DATABASE_URL=sqlite:///./data/fireguard.db`.

**Frontend:**

```bash
cd frontend
cp .env.example .env   # set VITE_API_BASE_URL and VITE_API_KEY
npm install
npm run dev
```

### Running the tests

```bash
cd backend
$env:PYTHONPATH = "..\third_party\dynamic-frcm-simple\src"   # PowerShell
export PYTHONPATH=../third_party/dynamic-frcm-simple/src      # bash

.\.venv\Scripts\python.exe -m pytest tests/ -v
```

Expected: **28 tests pass**. Tests use in-memory SQLite — no Postgres
needed.

---

## 3. API reference (examples)

All examples below assume auth is enabled. Protected routes accept either:

- `Authorization: Bearer <jwt>` for user login sessions
- `X-API-Key: <key>` for service-level access

```bash
# Health (no key required)
curl http://localhost:8000/health

# Register and log in
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"hunter22"}'

curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"hunter22"}'

# Location-based risk (live MET → FRCM)
curl -X POST http://localhost:8000/risk/location \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $KEY" \
  -d '{"lat": 60.39, "lon": 5.32}'

# Public watchlist
curl http://localhost:8000/watchlist

# CSV upload + run in one multipart call
curl -X POST http://localhost:8000/risk \
  -H "X-API-Key: $KEY" \
  -F "file=@third_party/dynamic-frcm-simple/bergen_2026_01_09.csv" \
  -F 'params={"weights":{"temperature":0.4,"humidity":0.4,"wind_speed":0.2}}'

# History
curl -H "X-API-Key: $KEY" http://localhost:8000/runs
curl -H "X-API-Key: $KEY" http://localhost:8000/runs/1

# Live event stream (no key required — browser EventSource can't set headers)
curl -N http://localhost:8000/events
```

---

## 4. Features vs peer-review checklist

| Peer-review item | Status |
|---|---|
| Fetch live weather from MET | ✅ `app/met_service.py::fetch_forecast` |
| REST API for fire risk by location | ✅ `POST /risk/location` |
| Integration with FRCM model | ✅ `app/frcm_service.py`, submodule at `third_party/dynamic-frcm-simple` |
| Background / automatic observation | ✅ `app/scheduler.py` polls 14 cities hourly and seeds missing cities on boot |
| Messaging between components | ✅ SSE pub/sub at `/events` |
| Persistent storage | ✅ PostgreSQL 16 (relational, containerised, volume-backed) |
| Authentication / authorization | ✅ JWT user auth plus `X-API-Key` fallback for service calls |
| Unit + integration tests | ✅ 28 tests — unit, integration, scheduler bootstrap, auth, watchlist |
| CI pipeline | ✅ GitHub Actions: test → docker-build → deploy |
| Dockerfiles | ✅ `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml` |
| Reachable on the web | ✅ http://158.37.63.124:8000 |
| HTTPS / TLS | ❌ *See limitations* |

---

## 5. Known limitations and pitfalls

These are real. Peer reviewers, please call them out in your review —
we'd rather be honest here than over-promise.

- **No HTTPS / TLS on the production deployment.** The NREC VM serves plain HTTP
  on ports 8000 and 5173. Acceptable for a student MVP on NREC's research
  network; not production-grade. Adding TLS would require a domain name
  (we only have an IP) and a reverse proxy like Caddy with a self-signed cert
  or Let's Encrypt.
- **Passwords are hashed in the database, but login still travels over plain HTTP
  on the public deployment.** The backend stores bcrypt hashes, not plaintext
  passwords, but without HTTPS a password can still be intercepted in transit.
  For demo use, treat accounts as low-trust and use non-reused passwords.
- **Authentication is MVP-level, not production-grade.** The app has
  registration, login, bcrypt password hashing, and JWT sessions, but no
  password reset, no email verification, no roles, and no account recovery.
- **API key is baked into the frontend bundle** at build time
  (`VITE_API_KEY`). Anyone who loads the frontend can inspect it in devtools.
  It authorizes the known-deployment frontend, *not* individual users.
  Rotating the key means redeploying the frontend.
- **JWT session tokens are stored in browser `localStorage`.** That is
  acceptable for a student MVP but weaker than an `HttpOnly` cookie setup.
  If the frontend had an XSS issue, a stolen token would be more likely than a
  stolen password.
- **`/events` SSE endpoint is unauthenticated.** Browser `EventSource`
  cannot set custom headers, so we exempt `/events` from auth. Anyone who
  knows the URL can subscribe to the run feed. The payload contains
  `run_id`, `risk_level`, `lat`, `lon` — non-sensitive.
- **The watchlist is global by design.** Watched-city runs are shared across
  users so the public home page has live data. Manual JWT-backed runs are
  user-owned, but scheduled city runs are intentionally public.
- **Scheduler state is in-memory.** If the backend container restarts, the
  APScheduler job state resets. In practice, the next hourly tick still
  fires on schedule, but there is no "catch-up" across restarts.
- **SSE subscriber queues are in-memory.** Clients connected when the backend
  restarts lose any events during the outage. Browser `EventSource` will
  reconnect automatically but historical events are not replayed.
- **CORS allow-list is hardcoded** in `backend/app/main.py`. Deploying to a
  new origin requires editing the code and redeploying.
- **`VITE_API_BASE_URL` is baked at build time.** Changing the backend URL
  requires rebuilding the frontend image, not just restarting.
- **Tests run against in-memory SQLite; production runs on Postgres.**
  Schema parity is not automatically enforced. Migrations are
  `Base.metadata.create_all()` at startup — fine for an MVP, not Alembic.
- **FRCM is a git submodule.** Forgetting `--recurse-submodules` during
  clone produces import errors at startup. If you see
  `ModuleNotFoundError: No module named 'frcm'`, run
  `git submodule update --init --recursive`.
- **No rate limiting.** A tight loop of `/risk/location` requests will pound
  MET Norway. MET's rate-limit headers are not respected.
- **No data retention / cleanup.** Runs and weather records accumulate
  forever. A `DELETE /runs/{id}` endpoint is not implemented.
- **Historical runs created before user auth was added may not have an owner.**
  Newly created manual runs are tied to a JWT user, but older records from the
  API-key-only phase remain legacy data.
- **Windows PowerShell gotcha:** invoking the venv as `.venv\Scripts\python.exe`
  fails with `could not load module '.venv'` because PowerShell parses the
  leading dot as a module path. Use `.\.venv\Scripts\python.exe` or
  activate the venv first with `.\.venv\Scripts\Activate.ps1`.

---

## 6. Deployment (NREC)

| Item | Value |
|---|---|
| Host | `158.37.63.124` (NREC OSL region) |
| Containers | `fireguard-postgres`, `fireguard-backend`, `fireguard-frontend` |
| Deploy trigger | Push to `main` |
| Deploy mechanism | GitHub Actions `appleboy/ssh-action` → `git reset --hard origin/main` → `docker compose up -d --build` |
| Health check | `curl --fail http://$NREC_HOST:8000/health` after 20s delay |

Required GitHub Actions secrets:

| Secret | Purpose |
|---|---|
| `NREC_HOST` | `158.37.63.124` |
| `NREC_USER` | SSH user (e.g. `ubuntu`) |
| `NREC_SSH_KEY` | Private key contents |
| `POSTGRES_PASSWORD` | Postgres password (random, long) |
| `FIREGUARD_API_KEY` | Shared API key (random, long) |
| `FIREGUARD_JWT_SECRET` | JWT signing secret (32+ chars) |

---

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| `ModuleNotFoundError: frcm` | `git submodule update --init --recursive` |
| `connection to server ... failed` | Wait for Postgres healthcheck; check `POSTGRES_PASSWORD` in `.env` |
| `401 Invalid or missing credentials` | Ensure your JWT is present or `VITE_API_KEY` matches `FIREGUARD_API_KEY` |
| `500 Server misconfigured` | Auth is enabled but `FIREGUARD_API_KEY` is empty on the backend |
| Login works locally but not after refresh | Ensure `FIREGUARD_JWT_SECRET` is set and stable across backend restarts |
| CORS error in browser | Your origin is not in the hardcoded allow-list at `backend/app/main.py:38` |
| Browser shows stale UI after redeploy | Hard refresh (Ctrl/Cmd+Shift+R); the frontend bundles env vars at build time |
| `PowerShell: could not load module '.venv'` | Use `.\.venv\Scripts\python.exe` or activate the venv first |

---

## 8. Git workflow

- **Trunk-based** on `main`, no long-lived feature branches in this project.
- Sprint-scoped commits (see `git log` — `Sprint 1/2/3/4` markers).
- Every push triggers the CI pipeline; only pushes to `main` trigger deploy.
- Tests + Docker build must pass before deploy runs.

---

## 9. Tech stack

| Layer | Choice | Version |
|---|---|---|
| Language (backend) | Python | 3.11 |
| Web framework | FastAPI | ≥0.110 |
| ORM | SQLAlchemy | 2.0 |
| Schemas | Pydantic | 2.9+ |
| Scheduler | APScheduler | 3.11 |
| Database | PostgreSQL | 16 (alpine) |
| Language (frontend) | TypeScript | 5.7 |
| UI | React + Vite | 18 + 6 |
| Styling | Tailwind CSS | 3.4 |
| Map | Leaflet + react-leaflet | 1.9 + 4.2 |
| Tests | pytest | 8 |
| Containers | Docker + Compose | — |
| CI/CD | GitHub Actions | — |
| Host | NREC | — |

---

## 10. Repository layout

```
fireguard-cloud/
├─ backend/
│  ├─ app/
│  │  ├─ main.py             FastAPI app + route handlers + lifespan
│  │  ├─ scheduler.py        APScheduler background polling
│  │  ├─ auth.py             JWT Bearer + X-API-Key middleware
│  │  ├─ security.py         bcrypt hashing + JWT issue/verify helpers
│  │  ├─ events.py           SSE pub/sub (asyncio queues)
│  │  ├─ met_service.py      MET Norway Locationforecast client
│  │  ├─ frcm_service.py     FRCM model adapter
│  │  ├─ risk_engine.py      CSV parser + legacy deterministic engine
│  │  ├─ db.py               SQLAlchemy models + engine/session
│  │  ├─ schemas.py          Pydantic request/response models
│  │  └─ storage.py          Persistence helpers
│  ├─ tests/                 28 pytest tests (unit + integration)
│  ├─ Dockerfile
│  └─ requirements.txt
├─ frontend/
│  ├─ src/
│  │  ├─ auth/               AuthProvider + route guard
│  │  ├─ pages/              LandingPage, DashboardPage, MapPage, HistoryPage, RunDetailsPage
│  │  ├─ components/         Layout, ResultCard, WatchlistGrid
│  │  └─ api/client.ts       Single HTTP client, injects JWT or X-API-Key
│  ├─ Dockerfile
│  └─ package.json
├─ third_party/
│  └─ dynamic-frcm-simple/   FRCM model (git submodule)
├─ docker-compose.yml        Postgres + backend + frontend
├─ .env.example              Template for secrets
├─ .github/workflows/ci.yml  Test → build → deploy
└─ README.md                 This file
```
