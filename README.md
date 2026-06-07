# reid-analytics

Web application for visualizing and analyzing multi-camera person re-identification
(ReID) data. It combines a map-based analytics UI with a person catalogue, sightings
timeline, OSINT lookup tools, and collaborative drawing layers.

The project is split into two independently deployable apps:

- `backend/` - Node.js / Express API. Serves layers, tiles, ReID person/sighting data
  (proxied from the `reid-db-handler` traits API), permissions, OSINT/Telegram lookups
  (proxied via the orchestrator service), and a Socket.IO realtime channel. Uses MongoDB
  for storing map layers and tile cache.
- `frontend/` - React + Vite single-page app (Leaflet/Cesium maps, MUI, Three.js 3D face
  viewer). Talks to the backend over a dev proxy (or nginx in production).

## Prerequisites

- Node.js 18+ and npm
- MongoDB 6+ (local or remote) for the backend
- A running `reid-db-handler` (traits API) for person/sighting data
- Optional: a running orchestrator service for Telegram/OSINT features
- Optional: a ReID worker service and a storage/media service

## Setup

Each app has its own `.env`. Copy the examples and fill in values:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### Backend env vars (`backend/.env`)

| Var | Description |
| --- | --- |
| `PORT` | Port the API listens on (default 3400). |
| `NODE_ENV` | `development` or `production`. |
| `MONGO_URI` | MongoDB connection string for layers/tiles. |
| `CORS_ORIGINS` | Comma-separated list of allowed browser origins. |
| `BASE_URL` | Public base URL used to build image URLs in responses. |
| `AUTO_SAVE_INTERVAL_LAYERS` | Layer auto-save interval in ms. |
| `TRAITS_API_URL` | Base URL of the reid-db-handler traits API. |
| `TRAITS_API_KEY` | API key (x-api-key) for the traits API. |
| `REID_WORKER_URL` | Base URL of the ReID worker service. |
| `STORAGE_SERVICE_URL` | Base URL of the storage/media service. |
| `ORCHESTRATOR_URL` | Base URL of the orchestrator (Telegram/OSINT proxy). |
| `API_KEY` | API key (x-api-key) sent to the orchestrator. |
| `TELEGRAM_PHONE` | Phone number used for automated Telegram OAuth. |
| `FLARESOLVERR_URL` | Optional FlareSolverr proxy URL for OSINT scraping. |

### Frontend env vars (`frontend/.env`)

| Var | Description |
| --- | --- |
| `VITE_BACKEND` | `local` or `remote` - selects which dev proxy target to use. |
| `VITE_API_KEY` | API key forwarded as x-api-key when proxying to the remote backend. |
| `VITE_REMOTE_TARGET` | Remote backend URL (used when `VITE_BACKEND=remote`). |
| `VITE_LOCAL_TARGET` | Local backend URL (used when `VITE_BACKEND=local`). |

No host/IP is hardcoded; all endpoints come from these env vars.

## Build

```bash
# Backend
cd backend && npm install

# Frontend
cd frontend && npm install && npm run build
```

## Run

```bash
# Backend (API + Socket.IO)
cd backend
npm run dev        # nodemon, or: npm start

# Frontend (Vite dev server on port 5400)
cd frontend
npm run local      # proxy to VITE_LOCAL_TARGET
# or
npm run dev        # proxy to VITE_REMOTE_TARGET (set VITE_REMOTE_TARGET + VITE_API_KEY)
```

The production build (`frontend/dist`) is served by any static host; an nginx config and
Dockerfiles are provided in each app folder.

## TLS / VPN / certificates (optional)

The app does not require any certificate or VPN to run. The frontend dev proxy uses
`secure: false` so a self-signed remote backend works without importing a cert. For local
development everything runs over plain HTTP against `localhost`. To talk to a secured
remote backend, set `VITE_REMOTE_TARGET` to its `https://host:port` URL and provide
`VITE_API_KEY`; no client certificate is needed. Optional nginx HTTP Basic Auth can be
enabled in production by mounting an `nginx/.htpasswd` file (gitignored, never committed).

## Notes

- This repo was extracted from a monorepo. The backend proxies ReID data through the
  `reid-db-handler` service and OSINT/Telegram features through the orchestrator service;
  it never connects to those databases directly.
- No model weights or large binaries ship with this project.
