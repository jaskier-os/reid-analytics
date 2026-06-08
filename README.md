# reid-analytics

Analytics and map UI for the ReID system. `backend/` is an Express API that reads
from reid-db-handler and its own MongoDB (for layers/maps) and proxies the
reid-worker, storage, and orchestrator services. `frontend/` is a Vite + React
app (Leaflet/Cesium maps, MUI) that talks to the backend. The deployed artifact is
the `reid-analytics-backend` image; the frontend is built to static assets.

## Build / run

Each app has its own `package.json`. Backend (Node, port 3400):

```bash
cd backend
npm install
cp .env.example .env   # then edit
npm run dev            # nodemon
npm start              # node mainServer.js
```

Frontend (Vite, dev server on 5173):

```bash
cd frontend
npm install
cp .env.example .env   # then edit
npm run dev            # proxies to the remote backend (VITE_BACKEND=remote)
npm run local          # proxies to a local backend
npm run build          # static build to dist/
```

Docker (backend only):

```bash
docker build -t reid-analytics-backend backend
```

The backend image installs Playwright + Chromium for OSINT scraping. CI builds
`backend/Dockerfile` and bumps the `reid-analytics-backend` image tag in the
deploy repo.

## Configuration

Both apps read env vars; each has its own `.env.example` as the source of truth.
Copy to `.env` and edit.

Backend - the ones that matter:

- `MONGO_URI` - MongoDB for layers/maps.
- `TRAITS_API_URL` / `TRAITS_API_KEY` - the reid-db-handler API.
- `REID_WORKER_URL`, `STORAGE_SERVICE_URL`, `ORCHESTRATOR_URL` + `API_KEY` -
  upstream services it proxies.
- `PORT` (3400), `BASE_URL`, `CORS_ORIGINS`.

Frontend:

- `VITE_BACKEND` - `remote` or `local`, selects the proxy target.
- `VITE_REMOTE_TARGET` / `VITE_LOCAL_TARGET` - backend URLs.
- `VITE_API_KEY` - forwarded as `x-api-key` to the remote backend.

## Dependencies

- Node 18+ both apps; backend is CommonJS, frontend is ESM.
- Backend pulls in Playwright (Chromium) for scraping and socket.io for live
  updates. Frontend uses Cesium, Leaflet, three.js, and MUI.
- Needs a reachable reid-db-handler and (for live data) reid-worker.
