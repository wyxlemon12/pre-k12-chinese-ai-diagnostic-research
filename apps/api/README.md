# API Harness

This FastAPI service hosts the early harness endpoints for the Pre-K12 Chinese AI diagnostic assistant.

## Local development

```powershell
uv sync --project apps/api
uv run --project apps/api python -m uvicorn app.main:app --app-dir apps/api --reload --host 127.0.0.1 --port 8000
```

## Current endpoints

- `GET /healthz`
- `POST /api/v1/lessons/parse`
- `POST /api/v1/lessons/pathways`
- `POST /api/v1/observations/diagnose`

## Browser access

The API now accepts local browser preflight requests from `http://127.0.0.1:5173`
and `http://localhost:5173`, including private-network preflight used by some
Chromium-based browsers.

## Verification

```powershell
apps/api/.venv/Scripts/python.exe -m unittest apps.api.tests.test_cors
```
