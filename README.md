# FireGuardCloud - Sprint 3

Sprint 3 turns FireGuard into a local end-to-end prototype:

- FastAPI backend with dataset upload, deterministic risk computation, and run history
- SQLite persistence for datasets and runs
- React + TypeScript dashboard for upload, risk run, and history views
- Docker Compose to run backend + frontend together

## Project structure

```text
backend/
  app/
    main.py
    db.py
    schemas.py
    storage.py
    auth.py
    risk_engine.py
  tests/

frontend/
  src/
    pages/
    components/
    api/

docker-compose.yml
```

Backend is still kept fairly small:

- `app/main.py`: FastAPI app setup and API routes
- `app/db.py`: SQLite models and database session setup
- `app/schemas.py`: request and response models
- `app/storage.py`: dataset file handling and response mapping
- `app/risk_engine.py`: deterministic CSV parsing and risk scoring
- `app/auth.py`: optional API key middleware

## Backend local run

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend URL: `http://localhost:8000`

## Frontend local run

```powershell
cd frontend
npm install
npm run dev
```

Frontend URL: `http://localhost:5173`

Set API base URL with:

```powershell
copy .env.example .env
```

`frontend/.env`:

```text
VITE_API_BASE_URL=http://localhost:8000
```

## Docker run

From repo root:

```powershell
docker compose up --build
```

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`

## API usage examples (curl)

### 1) Health

```bash
curl http://localhost:8000/health
```

### 2) Upload dataset

```bash
curl -X POST "http://localhost:8000/datasets" \
  -F "file=@third_party/dynamic-frcm-simple/bergen_2026_01_09.csv"
```

Save `dataset_id` from the response.

### 3) Run risk with existing dataset

```bash
curl -X POST "http://localhost:8000/risk" \
  -H "Content-Type: application/json" \
  -d "{\"dataset_id\":\"<dataset_id>\",\"params\":{\"weights\":{\"temperature\":0.5,\"humidity\":0.3,\"wind_speed\":0.2}}}"
```

### 4) Run risk with direct file upload

```bash
curl -X POST "http://localhost:8000/risk" \
  -F "file=@third_party/dynamic-frcm-simple/bergen_2026_01_09.csv" \
  -F "params={\"weights\":{\"temperature\":0.4,\"humidity\":0.4,\"wind_speed\":0.2}}"
```

### 5) List runs

```bash
curl http://localhost:8000/runs
```

## Sprint 3 evidence (local run)

Example successful UI run with `bergen_2026_01_09.csv`:

- Upload accepted and stored with generated `dataset_id`
- Row count: `132`
- Risk result:
  - `risk_score: 0.429`
  - `risk_level: medium`
- Top factors shown in UI:
  - `temperature` contribution `0.1928`
  - `humidity` contribution `0.1721`
  - `wind_speed` contribution `0.0640`

This confirms upload -> compute -> persist -> display flow is working end to end.

## Troubleshooting

If frontend shows `Failed to fetch`:

1. Start backend first on `http://localhost:8000`
2. Check `frontend/.env` has `VITE_API_BASE_URL=http://localhost:8000`
3. Restart frontend dev server after changing `.env`

## How risk is computed

Risk engine is deterministic and simple:

1. Parse CSV and validate required columns:
   - `temperature`, `humidity`, `wind_speed`
2. Normalize selected numeric columns to `[0, 1]`
3. Compute weighted sum and map to risk score `[0, 1]`
4. Map score to level:
   - `< 0.33` -> `low`
   - `< 0.66` -> `medium`
   - otherwise -> `high`
5. Return top contributing factors in `explain.top_factors`

## Optional API key protection

Environment variables:

- `FIREGUARD_AUTH_ENABLED=true|false`
- `FIREGUARD_API_KEY=<secret>`

When enabled, send key with header:

```text
X-API-Key: <secret>
```

## Backend tests

```powershell
cd backend
.venv\Scripts\python.exe -m pytest
```
