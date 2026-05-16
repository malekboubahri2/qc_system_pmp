# Devcontainer

One-click development environment for the Painting QC project.

## Prerequisites

- VS Code with the **Dev Containers** extension (`ms-vscode-remote.remote-containers`)
- Docker Desktop (or Docker Engine + docker compose on Linux)

## Open the project

1. `git clone` the repo
2. Open the repo folder in VS Code
3. Command Palette → **Dev Containers: Reopen in Container**
4. First build takes ~3–5 minutes; subsequent rebuilds take seconds

## What's inside

| Tool | Version |
|---|---|
| Python | 3.11 |
| uv | latest |
| Node.js | 20 |
| pnpm | 9 |
| GCC / make / cmake | system (Bookworm) |
| mosquitto-clients | system |
| sqlite3 | system |
| jq / ripgrep / fd | system |
| GitHub CLI | latest |
| Docker CLI | via host socket (docker-outside-of-docker) |

A Mosquitto broker runs as a sidecar at `mosquitto:1883` with anonymous
access — for dev/test only.

## What's NOT inside

- **STM32CubeIDE / TouchGFX Designer** — these stay on the host (GUI
  apps, USB-attached debugger). Firmware *builds* happen on the host.
  Firmware *host-side tests* (`firmware/tests/`, testing portable domain
  modules with GCC) work inside the devcontainer.

## Common tasks

| Task | Command (from `/workspace`) |
|---|---|
| Start server | `cd server && uv run uvicorn app.main:app --reload --host 0.0.0.0` |
| Start dashboard | `cd dashboard && pnpm dev --host` |
| Server tests | `cd server && uv run pytest` |
| Dashboard tests | `cd dashboard && pnpm test` |
| Firmware host tests | `cd firmware/tests && make && ./run_tests` |
| Apply DB migration | `cd server && uv run alembic upgrade head` |
| New DB migration | `cd server && uv run alembic revision --autogenerate -m "describe change"` |
| Probe MQTT broker | `mosquitto_sub -h mosquitto -t '#' -v` |
| Bring up full stack | `docker compose -f infra/docker-compose.dev.yml up --build` |

## Using the full dev stack

The devcontainer mounts the host Docker socket. You can run the full
application stack (`qc-server`, `mosquitto`, dashboard) from inside the
container with the same compose commands you'd use on the host. The
devcontainer network (`qc-dev`) is separate from the app network
(`qc-net`); they won't collide.

## Rebuilding

After editing `Dockerfile` or `docker-compose.yml`:
Command Palette → **Dev Containers: Rebuild Container**

## Troubleshooting

| Problem | Fix |
|---|---|
| Port 1883 already in use | Stop host-side Mosquitto: `brew services stop mosquitto` or `sudo systemctl stop mosquitto` |
| `uv` or `pnpm` not found | Run `bash .devcontainer/post-create.sh` manually |
| Slow file watching on macOS | The `cached` mount option mitigates this; for heavy Node watch tasks consider running `pnpm dev` from the terminal rather than the extension |
| Permission denied on `/var/run/docker.sock` | Add vscode user to docker group or use Rootless Docker |
