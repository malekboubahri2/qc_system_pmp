#!/usr/bin/env bash
# Deploy the Painting QC stack to the Raspberry Pi.
#
# Usage — image-based deploy (requires GHCR images built by CI):
#   QC_VERSION=v0.1.0 ./scripts/deploy.sh user@192.168.1.28
#
# Usage — local-build deploy (builds images from source on the RPi, no GHCR):
#   BUILD_LOCAL=1 ./scripts/deploy.sh user@192.168.1.28
#
# When run ON the RPi itself (detected by presence of /etc/qc/.env),
# the SSH/rsync step is skipped and commands run locally.
#
# One-time RPi setup for image-based deploys (GHCR auth):
#   echo $GHCR_PAT | docker login ghcr.io -u <github-user> --password-stdin
# The PAT needs read:packages scope and is stored in ~/.docker/config.json.
#
# One-time RPi setup for local-build deploys:
#   infra/.env must exist on the target at ~/qc-deploy/infra/.env
#   Mosquitto passwd must be bootstrapped (see docs/deployment.md).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

BUILD_LOCAL="${BUILD_LOCAL:-0}"

if [[ "$BUILD_LOCAL" == "1" ]]; then
    COMPOSE_FILE="infra/docker-compose.dev.yml"
else
    COMPOSE_FILE="infra/docker-compose.prod.yml"
fi

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

# ── Version / repo resolution ─────────────────────────────────────────────────
if [[ "$BUILD_LOCAL" == "1" ]]; then
    VERSION="local-build"
    GITHUB_REPO=""
else
    if [[ -z "${QC_VERSION:-}" ]]; then
        echo "ERROR: QC_VERSION must be set explicitly (e.g., 'v0.1.0' or 'sha-abc1234')." >&2
        echo "       Latest tag is not allowed for prod deploys (ADR-002)." >&2
        echo "       For a local-build deploy without GHCR images, set BUILD_LOCAL=1." >&2
        exit 2
    fi
    VERSION="$QC_VERSION"
    GITHUB_REPO="$(git -C "$REPO_ROOT" config --get remote.origin.url \
        | sed -E 's#.*github\.com[:/]([^/]+/[^/.]+)(\.git)?$#\1#')"
fi

echo "==> Mode     : ${BUILD_LOCAL:+local-build}${BUILD_LOCAL:-image (GHCR)}"
echo "==> Version  : $VERSION"
echo "==> Target   : ${SSH_TARGET:-localhost (on RPi)}"

run_on_target() {
    if [[ "$ON_RPI" == "1" ]]; then
        bash -c "$1"
    else
        ssh "$SSH_TARGET" "$1"
    fi
}

# ── Sync source to the RPi ────────────────────────────────────────────────────
if [[ "$ON_RPI" == "0" ]]; then
    if [[ "$BUILD_LOCAL" == "1" ]]; then
        echo "==> rsync source to RPi (excluding build artifacts)"
        rsync -avz --delete \
            --exclude='.git' \
            --exclude='node_modules' \
            --exclude='dist' \
            --exclude='.venv' \
            --exclude='__pycache__' \
            --exclude='*.pyc' \
            --exclude='.pytest_cache' \
            --exclude='server/qc-dev.db' \
            --exclude='server/uv.lock' \
            "$REPO_ROOT/" \
            "${SSH_TARGET}:~/qc-deploy/"
    else
        echo "==> rsync compose + mosquitto config to RPi"
        rsync -avz --delete \
            "$REPO_ROOT/infra/docker-compose.prod.yml" \
            "$REPO_ROOT/infra/mosquitto/" \
            "${SSH_TARGET}:~/qc-deploy/infra/"
    fi
fi

# ── Build / pull images and restart the stack ─────────────────────────────────
if [[ "$BUILD_LOCAL" == "1" ]]; then
    echo "==> Building images and restarting (this takes a few minutes on RPi)"
    run_on_target "
        set -e
        cd ~/qc-deploy
        docker compose -f $COMPOSE_FILE build --pull
        docker compose -f $COMPOSE_FILE up -d --remove-orphans
        docker compose -f $COMPOSE_FILE ps
    "
else
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
fi

# ── Health check (waits up to 90 s — ARM build takes longer to start) ────────
echo "==> Waiting for server health (max 90 s)"
for i in {1..18}; do
    sleep 5
    if run_on_target "curl -fs http://localhost:8000/health > /dev/null 2>&1"; then
        echo "==> Server healthy — deploy complete"
        exit 0
    fi
    echo "    attempt $i/18 — not yet healthy"
done

echo "ERROR: health check failed after 90 s" >&2
run_on_target "docker compose -f ~/qc-deploy/$COMPOSE_FILE logs --tail=30 qc-server" || true
exit 1
