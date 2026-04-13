# CI/CD Deployment to Hetzner — Design Spec

**Date:** 2026-04-13  
**Status:** Approved

## Context

Agent Scout runs on a Hetzner VPS with Docker. Currently, deployment is manual (ssh + git pull + docker compose up). This spec adds automated CI/CD via GitHub Actions.

## Architecture

### Services to deploy

- **api-bridge** — Express proxy to Ollama Cloud, containerized via `docker-compose.yml`
- **scout pipeline** — TypeScript pipeline running via cron (`0 7,15 * * *`)

### Approach: SSH Deploy

GitHub Actions SSH into the VPS on push to `main`, runs a deploy script.

**Why SSH deploy over Docker registry or SCP:** Single VPS, single maintainer, project solo. A registry is overkill. Build on CI + SCP is heavier to set up. SSH deploy is simple, direct, and sufficient.

## GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to Hetzner

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: bash /opt/agent-scout/deploy.sh
```

Deploy only triggers if tests pass.

## Deploy Script

`deploy.sh` at project root:

```bash
#!/bin/bash
set -euo pipefail

cd /opt/agent-scout

git pull origin main
npm ci --omit=dev
npm run build
docker compose up -d --build

# Health check
curl -sf http://localhost:3000/health || { echo "Health check failed"; exit 1; }
```

Separate script benefits:
- Reproducible locally: `ssh vps sudo bash /opt/agent-scout/deploy.sh`
- Testable independently from CI
- Simple workflow: SSH action just calls the script

## VPS Setup

**Directory:** `/opt/agent-scout/` (git clone of the repo)

**Prerequisites (already present on VPS):**
- Docker + Docker Compose
- Node.js 20+
- Git with deploy key for the repo
- Cron daemon

**Cron entry:**
```
0 7,15 * * * cd /opt/agent-scout && npm start >> /var/log/agent-scout.log 2>&1
```

**GitHub Secrets:**
- `VPS_HOST` — Hetzner server IP
- `VPS_USER` — SSH user (e.g. `root` or `deploy`)
- `VPS_SSH_KEY` — private SSH key for authentication

**`.env` file** stays on the VPS only, never in git.

## Security

- Dedicated deploy SSH key (not personal key), stored only in GitHub Secrets
- `.env` never in git (already in `.gitignore`)
- Workflow never reads Resend/Ollama secrets — they stay on the VPS
- `deploy.sh` fails fast with `set -euo pipefail`
- Health check after deploy verifies api-bridge is running

## Rollback

No automated rollback. Manual procedure:
```bash
cd /opt/agent-scout && git checkout HEAD~1 && bash deploy.sh
```

If deploy fails at any step, the VPS state doesn't change (git pull fails, build fails, or docker compose doesn't restart).

## Bug Fix: Timeout Mismatch

`server/index.js` has `TIMEOUT_MS = 120000` (2 min) but `src/synthesize.ts` was changed to `TIMEOUT_MS = 300000` (5 min). The server proxy will abort requests after 2 minutes regardless of the client timeout. Fix: update `server/index.js` timeout to 300000 to match.

## Files to Create/Modify

1. **Create** `.github/workflows/deploy.yml` — GitHub Actions workflow
2. **Create** `deploy.sh` — deploy script (with `chmod +x`)
3. **Fix** `server/index.js` — update timeout from 120s to 300s
4. **Update** `.env.example` — add missing `OLLAMA_API_KEY` and `OLLAMA_CLOUD_URL`
5. **Update** `.gitignore` — add `deploy.sh` if it shouldn't be in git (actually it should be in git for the workflow to access it)