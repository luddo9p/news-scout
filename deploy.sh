#!/bin/bash
set -euo pipefail

echo "=== Agent Scout Deploy ==="
echo "Starting deployment at $(date)"

cd /opt/agent-scout

echo "Pulling latest code..."
git pull origin main

echo "Installing dependencies..."
npm ci

echo "Building TypeScript..."
npm run build

echo "Rebuilding and restarting Docker containers..."
docker compose up -d --build

echo "Running health check..."
for i in 1 2 3 4 5; do
  if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
    echo "Health check passed!"
    echo "=== Deploy complete at $(date) ==="
    exit 0
  fi
  echo "Waiting for api-bridge... (attempt $i/5)"
  sleep 3
done

echo "ERROR: Health check failed after 5 attempts"
exit 1