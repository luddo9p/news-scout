# CI/CD Hetzner Deployment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up automated CI/CD deployment to a Hetzner VPS via GitHub Actions SSH deploy on push to main.

**Architecture:** GitHub Actions runs tests, then SSHs into the VPS to execute a deploy script that pulls the latest code, rebuilds, and restarts the Docker container. A health check verifies the deploy succeeded.

**Tech Stack:** GitHub Actions, SSH (appleboy/ssh-action), Docker Compose, Bash

---

### Task 1: Fix timeout mismatch in server/index.js

**Files:**
- Modify: `server/index.js:10`

- [ ] **Step 1: Update timeout from 120s to 300s**

Change line 10 in `server/index.js`:

```javascript
// Before:
const TIMEOUT_MS = 120000;

// After:
const TIMEOUT_MS = 300000;
```

This matches the client-side timeout in `src/synthesize.ts` (also 300000ms). Without this fix, the Express proxy will abort requests to Ollama Cloud after 2 minutes even though the client waits 5 minutes.

- [ ] **Step 2: Verify the change**

Run: `grep TIMEOUT_MS server/index.js src/synthesize.ts`
Expected: both files show `TIMEOUT_MS = 300000`

- [ ] **Step 3: Commit**

```bash
git add server/index.js
git commit -m "fix: align server proxy timeout with client timeout (5 min)"
```

---

### Task 2: Update .env.example with missing variables

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add OLLAMA_API_KEY and OLLAMA_CLOUD_URL**

Replace the contents of `.env.example` with:

```env
# Required
VPS_URL=http://localhost:3000
API_KEY=your_api_key_secret
RESEND_API_KEY=re_xxxxx
RESEND_TO=your@email.com

# Required (Docker)
OLLAMA_API_KEY=your_ollama_cloud_key
OLLAMA_CLOUD_URL=https://ollama.com

# Optional
RESEND_FROM=onboarding@resend.dev
BLUESKY_HANDLE=yourhandle.bsky.social
BLUESKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
APIFY_API_KEY=
```

- [ ] **Step 2: Verify the change**

Run: `grep -c OLLAMA .env.example`
Expected: 2 (OLLAMA_API_KEY and OLLAMA_CLOUD_URL)

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "docs: add missing OLLAMA env vars to .env.example"
```

---

### Task 3: Create deploy.sh

**Files:**
- Create: `deploy.sh`

- [ ] **Step 1: Write deploy.sh**

Create `deploy.sh` at project root:

```bash
#!/bin/bash
set -euo pipefail

echo "=== Agent Scout Deploy ==="
echo "Starting deployment at $(date)"

cd /opt/agent-scout

echo "Pulling latest code..."
git pull origin main

echo "Installing dependencies..."
npm ci --omit=dev

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
```

Note: The health check uses port 3001 (the host-mapped port in `docker-compose.yml`), not 3000 (the internal container port).

- [ ] **Step 2: Make it executable**

Run: `chmod +x deploy.sh`

- [ ] **Step 3: Verify**

Run: `ls -la deploy.sh`
Expected: file has execute permission (`-rwxr-xr-x`)

Run: `bash -n deploy.sh`
Expected: no output (valid syntax)

- [ ] **Step 4: Commit**

```bash
git add deploy.sh
git commit -m "feat: add deploy script for CI/CD"
```

---

### Task 4: Create GitHub Actions workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create workflow directory**

Run: `mkdir -p .github/workflows`

- [ ] **Step 2: Write deploy.yml**

Create `.github/workflows/deploy.yml`:

```yaml
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
    if: success()
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: bash /opt/agent-scout/deploy.sh
```

- [ ] **Step 3: Verify YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))"`
Expected: no output (valid YAML)

If python3 with PyYAML isn't available, visually verify the indentation and structure match the spec.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Actions workflow for Hetzner deployment"
```

---

### Task 5: Final verification and push

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 2: Verify build succeeds**

Run: `npm run build`
Expected: no errors

- [ ] **Step 3: Review all changes**

Run: `git log --oneline -5`
Expected: 4 commits (timeout fix, env example, deploy script, workflow)

Run: `git diff main...HEAD --stat`
Expected: 4 files changed (server/index.js, .env.example, deploy.sh, .github/workflows/deploy.yml)

- [ ] **Step 4: Push to main**

```bash
git push origin main
```

This will trigger the GitHub Actions workflow. Verify in the Actions tab that:
1. The `test` job passes
2. The `deploy` job runs and SSHs into the VPS

- [ ] **Step 5: Configure GitHub Secrets**

In the GitHub repo Settings → Secrets and variables → Actions, add:
- `VPS_HOST` — Hetzner server IP address
- `VPS_USER` — SSH username (e.g. `root`)
- `VPS_SSH_KEY` — private SSH key for the deploy key

- [ ] **Step 6: Verify deployment on VPS**

After the Actions workflow completes, SSH into the VPS and verify:
```bash
ssh your-vps
cd /opt/agent-scout
git log -1  # should show latest commit
docker compose ps  # api-bridge should be running
curl http://localhost:3001/health  # should return {"status":"ok"}
```