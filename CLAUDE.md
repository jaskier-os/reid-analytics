# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

IMPORTANT: NEVER USE EMOJIS ANYWHERE IN LOGGING, CODE, OR OTHER TEXT.

IMPORTANT: Treat this codebase as work in progress. Never add backwards-compatibility
or legacy support unless explicitly asked. When a change may break a dependency, go
refactor every dependency rather than preserving the old path. Remove code that
becomes redundant.

## What this is

reid-analytics is the analytics and map UI for the ReID system. It has two apps:

- `backend/` -- Express API (port 3400). Reads from reid-db-handler and its own
  MongoDB (layers/maps), proxies reid-worker (photo identification) and other
  services, adds OSINT enrichment via Telegram bots, serves real-time updates over
  Socket.IO, and proxies map/fire tiles. The deployed artifact is the
  `reid-analytics-backend` image. **Detailed guidance for the backend lives in
  `backend/CLAUDE.md` -- read it when working there.**
- `frontend/` -- Vite + React app (Leaflet/Cesium maps, MUI) that talks to the
  backend. Renders the recognized-people catalogue, person sightings, metadata, and
  map layers. Built to static assets.

This is one of three tightly coupled ReID services. For the whole-system map (every
service, port map, architecture), see the orchestrator repo's CLAUDE.md / docs
(jaskier-os/orchestrator) rather than duplicating it here.

- **reid-db-handler repo** -- only service that talks to the database directly;
  source of all person/trait/sighting/relation data.
- **reid-worker repo** -- recognizes people from camera feeds; this backend proxies
  it for photo identification.
- **reid-analytics** (this repo) -- aggregates reid-db-handler data for the frontend.

## Architecture rule (KEEP PROMINENT)

The backend MUST NEVER talk to the ReID database directly. All person / sighting /
trait / camera / OSINT-asset operations go through the reid-db-handler HTTP API
(`TRAITS_API_URL`) via `backend/services/reidService.js`. Photo identification goes
to reid-worker (`REID_WORKER_URL`). The backend's own MongoDB is only for analytics-
local data (map layers, tile cache). Never add a direct connection to the ReID DB.

## Coupling rule

These three repos are bound by shared protocols. The dependency chain is:
reid-db-handler schema -> reid-analytics export -> frontend. When changing one, check
the others before assuming the contract holds. Concretely:

- Changing the frontend's data needs: inspect `backend/` to see what is exported,
  then inspect reid-db-handler to see what data actually exists and its schema.
- Changing a reid-db-handler schema: confirm `backend/services/reidService.js` and
  `socketService.js` still aggregate/poll correctly, then confirm the frontend still
  renders it.

A change touching the wire format almost always touches all three.

## Build / run

Each app has its own `package.json`.

Backend (Node, port 3400):

```bash
cd backend
npm install
cp .env.example .env   # then edit (TRAITS_API_URL/KEY for reid-db-handler, REID_WORKER_URL, Telegram, Mongo)
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

Docker: each app has its own `Dockerfile`.

## Deploy

Deploy is via CI: commit + push, let GitLab CI build the Dockerfiles and bump the
image tags in the deployment catalog repo. Never build/push images by hand and never
edit Kubernetes deployments/env/secrets directly (`kubectl set env`/`edit`/`patch`)
-- those get overwritten by Flux. All deployed-service changes go through the
deployment catalog manifests. When changing backend `.env` values, update the
corresponding secrets in the deployment catalog too.

## Service management

Never restart any deployed service unless the user explicitly asks. When a restart is
needed, tell the user which service and why.

Do not write documentation unless asked to. (The existing `backend/CLAUDE.md` is an
agent-guidance file, not user docs -- keep it current when you change the backend.)
