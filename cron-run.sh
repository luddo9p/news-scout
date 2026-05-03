#!/usr/bin/env bash
set -euo pipefail

AGENT="${1}"
if [[ -z "${AGENT}" ]]; then
  echo "Usage: cron-run.sh --agent <agent-name>" >&2
  exit 1
fi

AGENT="${AGENT#--agent=}"

cd /opt/agent-scout
export PATH="/root/.nvm/versions/node/$(ls /root/.nvm/versions/node/ | sort -V | tail -1)/bin:${PATH}"

LOG_DIR="/var/log/agent-scout"
mkdir -p "${LOG_DIR}"

LOG_FILE="${LOG_DIR}/${AGENT}-$(date +%Y%m%d).log"

echo "[$(date -Iseconds)] Starting ${AGENT}" >> "${LOG_FILE}"
npm start -- "--agent=${AGENT}" >> "${LOG_FILE}" 2>&1
EXIT_CODE=$?
echo "[$(date -Iseconds)] Finished ${AGENT} (exit: ${EXIT_CODE})" >> "${LOG_FILE}"

exit ${EXIT_CODE}