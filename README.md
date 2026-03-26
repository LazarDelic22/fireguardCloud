# FireGuard Cloud

A cloud-based fire risk assessment service built across three sprints. It fetches live weather forecasts from MET Norway, runs them through the dynamic-frcm-simple fire risk model, and exposes the results through a REST API and a React dashboard.

## What it does

- **Location-based risk**: send a latitude/longitude, get live weather from MET Norway, run it through the FRCM model, and receive a fire risk score with TTF (time to flashover) estimates
- **CSV-based risk**: upload a CSV with weather columns and get a deterministic risk score
- **Run history**: all runs are stored in SQLite with full parameters and explain data
- **Real-time events**: subscribe to `/events` (SSE) to receive notifications when new risk runs are created
- **Optional API key auth**: can be enabled via environment variable

## Project structure

```
backend/
  app/
    main.py          - FastAPI routes
    db.py            - SQLAlchemy models (Dataset, WeatherRecord, Run)
    schemas.py       - Pydantic request/response models
    storage.py       - DB helpers and response mapping
    risk_engine.py   - Deterministic CSV risk engine
    frcm_service.py  - FRCM model adapter
    met_service.py   - MET Norway Locationforecast 2.0 client
    events.py        - SSE broadcast system
    auth.py          - Optional API key middleware
  tests/

frontend/
  src/
    pages/           - Dashboard, History, RunDetails
    components/      - ResultCard, NavBar
    api/client.ts    - API client

third_party/
  dynamic-frcm-simple/  - FRCM model (git submodule)

docker-compose.yml
.github/workflows/ci.yml
```

## Running locally

**Backend:**
```bash
cd backend
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
set PYTHONPATH=../third_party/dynamic-frcm-simple/src
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Docker Compose (recommended):**
```bash
docker compose up --build
```

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`
- API docs: `http://localhost:8000/docs`

## API examples

### Health check
```bash
curl http://localhost:8000/health
```

### Location-based risk (MET + FRCM)
```bash
curl -X POST http://localhost:8000/risk/location \
  -H "Content-Type: application/json" \
  -d '{"lat": 60.39, "lon": 5.32}'
```

Returns risk score, level, and FRCM TTF estimates.

### CSV-based risk
```bash
# Upload a dataset
curl -X POST http://localhost:8000/datasets \
  -F "file=@third_party/dynamic-frcm-simple/bergen_2026_01_09.csv"

# Run risk on the dataset (use dataset_id from above)
curl -X POST http://localhost:8000/risk \
  -H "Content-Type: application/json" \
  -d '{"dataset_id": "<id>", "params": {}}'
```

### Run history
```bash
curl http://localhost:8000/runs
curl http://localhost:8000/runs/1
```

### Subscribe to events (SSE)
```bash
curl -N http://localhost:8000/events
```

## How risk is computed

**Location path (FRCM model):**
1. Fetch 48-hour forecast from MET Norway Locationforecast 2.0
2. Convert to WeatherData objects and run through dynamic-frcm-simple
3. Map minimum TTF to risk: `risk_score = 1 - (min_ttf / 10)`, capped at 1
4. Thresholds: TTF < 3h = high, 3–5h = medium, > 5h = low

**CSV path (deterministic engine):**
1. Parse CSV, validate columns (temperature, humidity, wind_speed)
2. Normalize columns to [0, 1] and compute weighted sum
3. Thresholds: score < 0.33 = low, < 0.66 = medium, otherwise high

## Cloud deployment (NREC)

The app runs on an NREC VM (OSL region) at `158.37.63.124`.

- Backend: `http://158.37.63.124:8000`
- Frontend: `http://158.37.63.124:5173`
- API docs: `http://158.37.63.124:8000/docs`

The CI/CD pipeline (`.github/workflows/ci.yml`) runs tests and a Docker build on every push. On push to `main` it deploys automatically via SSH using these repository secrets:

| Secret | Value |
|--------|-------|
| `NREC_HOST` | `158.37.63.124` |
| `NREC_USER` | `ubuntu` |
| `NREC_SSH_KEY` | contents of `fireguard-key.pem` |

## Tests

```bash
cd backend
.venv/Scripts/python.exe -m pytest tests/ -v
```

## Optional API key auth

Set in environment or `.env`:
```
FIREGUARD_AUTH_ENABLED=true
FIREGUARD_API_KEY=mysecretkey
```

Then include header `X-API-Key: mysecretkey` with requests.
