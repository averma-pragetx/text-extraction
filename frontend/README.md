# EPCFlow — Scope 1 UI

Vite + React frontend for the EPCFlow platform. Backend: FastAPI.

## Run
```bash
npm install
npm run dev
```
Open http://localhost:5173

## Wire to FastAPI
In `src/App.jsx`, top of file:
- set `USE_MOCK = false`
- `API_BASE` defaults to `http://localhost:8000/api/v1`
- JWT is read from `localStorage.epcflow_token`
- `vite.config.js` already proxies `/api` to `http://localhost:8000`

Each screen (Dashboard, Documents, Forecasting, Workflows, Analytics) has static
demo data inline — replace with `api()` calls per the build-spec endpoints.

## Stack
react · recharts (charts) · lucide-react (icons) · Space Grotesk + Space Mono
