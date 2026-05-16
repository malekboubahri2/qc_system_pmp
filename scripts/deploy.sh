#!/usr/bin/env bash
# Deploy the Painting QC stack to the Raspberry Pi.
#
# Usage:
#   ./scripts/deploy.sh                       # deploys to $QC_HOST (env var)
#   ./scripts/deploy.sh pi@192.168.1.100      # deploys to given SSH target
#   QC_VERSION=v0.1.0 ./scripts/deploy.sh     # pin a specific image tag
#
# When run ON the RPi itself (detected by presence of /etc/qc/.env),
# the SSH step is skipped and commands run locally.
#
# One-time RPi setup (GHCR auth):
#   echo $GHCR_PAT | docker login ghcr.io -u <github-user> --password-stdin
# The PAT needs read:packages scope and is stored in ~/.docker/config.json.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="infra/docker-compose.prod.yml"

# ── Detect whether we're already on the RPi ──────────────────────────────────
if [[ -f /etc/qc/.env ]]; then
    ON_RPI=1
    SSH_TARGET=""
else
    ON_RPI=0
    SSH_TARGET="${1:-${QC_HOST:-}}"
    if [[ -z "$SSH_TARGET" ]]; then
        echo "ERROR: set \$QC_HOST or pass user@host as the first argument" >&2
        exit 2
    fi
fi

if [[ -z "${QC_VERSION:-}" ]]; then
    echo "ERROR: QC_VERSION must be set explicitly (e.g., 'v0.1.0' or 'sha-abc1234')." >&2
    echo "       Latest tag is not allowed for prod deploys (ADR-002)." >&2
    exit 2
fi
VERSION="$QC_VERSION"
GITHUB_REPO="$(git -C "$REPO_ROOT" config --get remote.origin.url \
    | sed -E 's#.*github\.com[:/]([^/]+/[^/.]+)(\.git)?$#\1#')"

echo "==> Version  : $VERSION"
echo "==> Repo     : $GITHUB_REPO"
echo "==> Target   : ${SSH_TARGET:-localhost (on RPi)}"

run_on_target() {
    if [[ "$ON_RPI" == "1" ]]; then
        bash -c "$1"
    else
        ssh "$SSH_TARGET" "$1"
    fi
}

# ── Sync compose + mosquitto config to the RPi (remote deploys only) ─────────
if [[ "$ON_RPI" == "0" ]]; then
    echo "==> rsync configs to RPi"
    rsync -avz --delete \
        "$REPO_ROOT/infra/docker-compose.prod.yml" \
        "$REPO_ROOT/infra/mosquitto/" \
        "${SSH_TARGET}:~/qc-deploy/infra/"
fi

# ── Pull images and restart the stack ────────────────────────────────────────
echo "==> Pulling images and restarting"
run_on_target "
    set -e
    cd ~/qc-deploy
    export QC_VERSION='$VERSION'
    export GITHUB_REPOSITORY='$GITHUB_REPO'
    docker compose -f $COMPOSE_FILE pull
    docker compose -f $COMPOSE_FILE up -d --remove-orphans
    docker compose -f $COMPOSE_FILE ps
"

# ── Health check (waits up to 60 s for /health to respond) ───────────────────
echo "==> Waiting for server health (max 60 s)"
for i in {1..12}; do
    sleep 5
    if run_on_target "curl -fs http://localhost:8000/health > /dev/null 2>&1"; then
        echo "==> Server healthy — deploy complete"
        exit 0
    fi
    echo "    attempt $i/12 — not yet healthy"
done

echo "ERROR: health check failed after 60 s" >&2
run_on_target "docker compose -f ~/qc-deploy/$COMPOSE_FILE logs --tail=30 server" || true
exit 1
