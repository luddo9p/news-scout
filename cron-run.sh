#!/usr/bin/env bash
set -euo pipefail

AGENT="${1:-}"
# The crontab examples pass the flag and its value as two arguments
# (`cron-run.sh --agent tech-ai`) while this script also accepts `--agent=tech-ai`.
# Reading $1 alone resolved the agent to "--agent", which the dispatcher rejects, so
# every cron run died with "Unknown agent" and sent nothing.
if [[ "${AGENT}" == "--agent" ]]; then
  AGENT="${2:-}"
fi
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
# Written through an `if` on purpose: with `set -e` a bare failing `npm start` aborted
# the script before the "Finished" line, leaving a log that stopped at "Starting" and
# told nobody whether the run had failed or was still going.
if npm start -- "--agent=${AGENT}" >> "${LOG_FILE}" 2>&1; then
  EXIT_CODE=0
else
  EXIT_CODE=$?
fi
echo "[$(date -Iseconds)] Finished ${AGENT} (exit: ${EXIT_CODE})" >> "${LOG_FILE}"

exit ${EXIT_CODE}