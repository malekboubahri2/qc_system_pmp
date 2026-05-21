#!/usr/bin/env bash
# Deploy the Painting QC stack.
#
# ── Modes ─────────────────────────────────────────────────────────────────────
#
# Devcontainer / local Docker (no SSH, no rsync):
#   LOCAL=1 ./scripts/deploy.sh
#
# Remote local-build (builds images from source on the RPi, no GHCR):
#   BUILD_LOCAL=1 ./scripts/deploy.sh user@192.168.1.28
#
# Remote image-based (pulls GHCR images built by CI):
#   QC_VERSION=v0.1.0 ./scripts/deploy.sh user@192.168.1.28
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

LOCAL="${LOCAL:-0}"
BUILD_LOCAL="${BUILD_LOCAL:-0}"

# LOCAL always builds from source
if [[ "$LOCAL" == "1" ]]; then
    BUILD_LOCAL=1
fi

if [[ "$BUILD_LOCAL" == "1" ]]; then
    COMPOSE_FILE="infra/docker-compose.dev.yml"
else
    COMPOSE_FILE="infra/docker-compose.prod.yml"
fi

# ── Detect deployment target ──────────────────────────────────────────────────
if [[ "$LOCAL" == "1" ]]; then
    DEPLOY_MODE="local"
    DEPLOY_DIR="$REPO_ROOT"
    SSH_TARGET=""
elif [[ -f /etc/qc/.env ]]; then
    DEPLOY_MODE="on-rpi"
    DEPLOY_DIR="$HOME/qc-deploy"
    SSH_TARGET=""
else
    DEPLOY_MODE="ssh"
    DEPLOY_DIR="~/qc-deploy"
    SSH_TARGET="${1:-${QC_HOST:-}}"
    if [[ -z "$SSH_TARGET" ]]; then
        echo "ERROR: set \$QC_HOST or pass user@host as the first argument" >&2
        echo "       For a local devcontainer deploy, set LOCAL=1." >&2
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

if [[ "$LOCAL" == "1" ]]; then
    _MODE="local (devcontainer)"
elif [[ "$BUILD_LOCAL" == "1" ]]; then
    _MODE="remote local-build"
else
    _MODE="image-based (GHCR)"
fi
echo "==> Mode     : $_MODE"
echo "==> Version  : $VERSION"
echo "==> Target   : ${SSH_TARGET:-localhost}"
echo "==> Work dir : $DEPLOY_DIR"

run_on_target() {
    if [[ "$DEPLOY_MODE" == "ssh" ]]; then
        ssh "$SSH_TARGET" "$1"
    else
        bash -c "$1"
    fi
}

# ── Sync source to remote ─────────────────────────────────────────────────────
if [[ "$DEPLOY_MODE" == "ssh" ]]; then
    if [[ "$BUILD_LOCAL" == "1" ]]; then
        echo "==> rsync source to RPi (excluding build artifacts)"
        rsync -avz --delete \
            --exclude='.git' \
            --exclude='node_modules' \
            --exclude='.pnpm-store' \
            --exclude='dist' \
            --exclude='.venv' \
            --exclude='__pycache__' \
            --exclude='*.pyc' \
            --exclude='.pytest_cache' \
            --exclude='server/qc-dev.db' \
            --exclude='server/uv.lock' \
            --exclude='infra/mosquitto/passwd' \
            --exclude='infra/mosquitto/data' \
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

# ── Install systemd service (remote BUILD_LOCAL only, requires sudo on target) ─
if [[ "$BUILD_LOCAL" == "1" && "$DEPLOY_MODE" == "ssh" ]]; then
    SERVICE_DEST="/etc/systemd/system/qc-stack.service"
    if run_on_target "test -f $SERVICE_DEST" 2>/dev/null; then
        echo "==> systemd service already installed — skipping"
    else
        echo "==> NOTE: install the systemd service for auto-start on boot:"
        echo "    ssh $SSH_TARGET 'sudo cp ~/qc-deploy/infra/qc-stack.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable qc-stack'"
    fi
fi

# ── Build / pull images and restart the stack ─────────────────────────────────
if [[ "$BUILD_LOCAL" == "1" ]]; then
    echo "==> Building images and restarting"
    run_on_target "
        set -e
        cd $DEPLOY_DIR
        docker compose -f $COMPOSE_FILE build --pull
        docker compose -f $COMPOSE_FILE up -d --remove-orphans
        docker compose -f $COMPOSE_FILE ps
    "
else
    echo "==> Pulling images and restarting"
    run_on_target "
        set -e
        cd $DEPLOY_DIR
        export QC_VERSION='$VERSION'
        export GITHUB_REPOSITORY='$GITHUB_REPO'
        docker compose -f $COMPOSE_FILE pull
        docker compose -f $COMPOSE_FILE up -d --remove-orphans
        docker compose -f $COMPOSE_FILE ps
    "
fi

# ── Health check (waits up to 90 s) ──────────────────────────────────────────
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
run_on_target "docker compose -f $DEPLOY_DIR/$COMPOSE_FILE logs --tail=30 qc-server" || true
exit 1
