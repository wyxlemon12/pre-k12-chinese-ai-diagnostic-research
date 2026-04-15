# API Harness

This FastAPI service hosts the early harness endpoints for the Pre-K12 Chinese AI diagnostic assistant.

## Local development

```powershell
uv sync --project apps/api
uv run --project apps/api fastapi dev apps/api/app/main.py --host 127.0.0.1 --port 8000
```
