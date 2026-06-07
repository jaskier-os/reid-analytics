#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

# Wait for MongoDB replica set if not ready yet
echo "[reid-analytics-backend] Waiting for MongoDB..."
elapsed=0
until docker exec reid-mongodb mongosh --quiet --eval 'rs.status().ok' 2>/dev/null; do
    sleep 1
    elapsed=$((elapsed + 1))
    if [ $elapsed -ge 120 ]; then
        echo "[reid-analytics-backend] ERROR: MongoDB not ready after 120s"
        exit 1
    fi
done
echo "[reid-analytics-backend] MongoDB is ready"

echo "[reid-analytics-backend] Installing dependencies..."
npm install --silent

echo "[reid-analytics-backend] Starting..."
exec node mainServer.js
