# Deployment Guide — Network Setup & First-Boot Checklist

This document covers everything needed to get the QC stack running at a
plant site: plant IT requirements, RPi provisioning, Docker bring-up,
Mosquitto credential bootstrapping, and STM32 device verification.

For architectural decisions behind these choices see `docs/decisions.md`
(ADR-002 through ADR-007). For MQTT topic structure see `docs/mqtt-topics.md`.

---

## 1. Network Topology

### Option A — RPi on existing plant Wi-Fi (default)

```
Plant LAN (wired)
       │
   [Switch]
       │
   [Wi-Fi AP]          SSID: <qc-system-ssid>   WPA2-PSK
       │                2.4 GHz only
   ───────────────┬─────────────────────┬───────────────
   │              │                     │
[RPi 4B]   [Station tablets]   [STM32H7B3I-DK andon board]
static IP /  inspection PWA      ESP-01 Wi-Fi module
DHCP reserv. HTTPS → :443        HTTP GET /kpi (display only)
runs the stack
```

The RPi connects to the plant AP via its wired Ethernet (recommended) or its
own Wi-Fi interface. **Station tablets** run the inspection PWA and reach the
server over HTTPS (`:443`, Caddy). The **STM32 andon board** is display-only: it
joins the same AP over 2.4 GHz via an external ESP-01 (ESP8266; 2.4 GHz only,
so the AP must serve a 2.4 GHz band) and polls `GET /kpi`.

All clients must be on the same Layer-3 subnet as the RPi. No VPN or NAT
between them.

### Option B — Dedicated travel router (fallback)

If plant IT cannot guarantee the requirements in section 2, use a small
travel router (e.g., GL.iNet GL-MT300N-V2):

```
Plant LAN ──[RPi Eth]──[Travel router]──[STM32 Wi-Fi]
```

The RPi connects to the router's LAN port; the router serves a private SSID
at 192.168.8.0/24 (or whatever the router default is). The STM32 joins that
SSID. No IT coordination required. The router's SSID and PSK are set once
and burned into the device's Octo-SPI at provisioning time.

### Friendly hostname — `inspection.pmp` (dnsmasq)

Tablets reach the platform at `https://inspection.pmp` instead of a raw IP. The
`dnsmasq` container resolves the name to the RPi's **current** DHCP IP — it uses
dnsmasq's `interface-name`, so the config never hardcodes an address and the
name follows the lease (`QC_DOMAIN` / `UPSTREAM_DNS` / `LAN_IFACE` in `.env`). It
runs with `network_mode: host` so it can read the live interface address and
bind `:53` on the LAN.

Point clients' DNS at the RPi so they use it:

- **Preferred:** in the plant router's DHCP, set the primary DNS to the RPi's
  address, and give the RPi a **DHCP reservation** (so that pointer — and the
  address tablets resolve to — stays valid; `interface-name` still means you
  never edit dnsmasq if the reservation is later changed).
- **Or per-tablet:** set the kiosk tablet's DNS manually to the RPi's IP.

Then `https://inspection.pmp` works: Caddy issues an internal-CA cert for the
name on demand. Install Caddy's root CA on each tablet once (see
`docs/runbook-kiosk.md`) so the lock is trusted and the PWA can install + run
offline. **The andon board keeps using the RPi's IP** (`KPI_SERVER_HOST`) — the
wall display should not depend on DNS.

---

## 2. Plant IT Requirements (Option A)

Before arrival at the site, confirm these items with the plant IT contact:

| Requirement | Why |
|---|---|
| Andon board on 2.4 GHz SSID | ESP-01 (ESP8266) is 802.11 b/g/n; no 5 GHz support |
| Client isolation **off** | Tablets and the andon board must reach the RPi over WLAN; isolation blocks it |
| TCP port **443** open between WLAN clients | Tablets reach the server over HTTPS (Caddy) |
| TCP port **1883** open (only if MQTT KPI option used) | Mosquitto; the andon board's default is HTTP `GET /kpi`, so this is optional |
| WPA2-PSK (not 802.1X/enterprise) | ESP-01 AT-command firmware does not implement EAP |
| Static IP **or** DHCP reservation for the RPi | The andon board has the server host baked into its Octo-SPI config; it must not change |
| RSSI ≥ −65 dBm at every station and the andon wall | ESP-01 reliable-operation floor; painting equipment is electrically noisy |

If any item cannot be confirmed, fall back to Option B.

---

## 3. Site Survey

Run the survey before pilot deployment (mandatory — see `docs/roadmap.md`
Day 31 gate):

1. Walk each inspection station with a Wi-Fi analyser (e.g., WiFi Analyzer
   on Android or `iw dev wlan0 scan` on a Linux laptop).
2. Record SSID, BSSID, channel, and signal strength (dBm) at each position.
3. Verify signal ≥ −65 dBm at all stations. Stations below threshold need
   an additional AP or an alternative mounting position for the terminal.
4. Note channel contention and interference from VFDs, welding equipment,
   or microwave ovens near the production line. Request a dedicated 2.4 GHz
   channel if interference is observed.
5. Document the survey results; keep the spreadsheet alongside this guide
   for the pilot review.

---

## 4. Raspberry Pi — First-Time Setup

### 4.1 Flash the OS

Use Raspberry Pi Imager (or `dd`/`rpi-imager` on Linux).

- OS: **Raspberry Pi OS Lite 64-bit (Bookworm)**
- Hostname: `qc-server`
- Enable SSH with a strong password or authorised key
- Do **not** install a desktop environment

### 4.2 Static IP or DHCP reservation

**Preferred — DHCP reservation on the router/AP:**

Ask plant IT to reserve the RPi's MAC address to a fixed IP
(e.g., `192.168.1.100`). The RPi stays a DHCP client; the IP is stable.

**Alternative — Static IP on the RPi:**

Edit `/etc/dhcpcd.conf`:

```
interface eth0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1
```

Restart: `sudo systemctl restart dhcpcd`

Record the chosen IP in `.env` as `BROKER_HOST` before provisioning any
STM32. The firmware has this address in its Octo-SPI config; changing the
IP after provisioning requires re-flashing every device.

### 4.3 Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in for the group change to take effect
docker --version   # verify
```

### 4.4 Clone the repository

```bash
git clone <repo-url> ~/qc_system_pmp
cd ~/qc_system_pmp
```

### 4.5 Create the environment file

```bash
cp infra/.env.example infra/.env
# Edit infra/.env — fill in all required values
# JWT_SECRET, MQTT_SERVER_PASSWORD, and PLANT_NAME are mandatory
nano infra/.env
```

The `.env` file is gitignored. Never commit it. See `infra/.env.example`
for all supported keys.

---

## 5. Mosquitto — Credential Bootstrap

Mosquitto requires a password file before it will accept connections.
The file is bind-mounted from `infra/mosquitto/passwd` (gitignored).

### 5.1 Create the server account (once per deployment)

```bash
# -c creates the file; only use -c the very first time
docker compose -f infra/docker-compose.dev.yml run --rm mosquitto \
  mosquitto_passwd -c /mosquitto/config/passwd qc-server
```

Enter the same password you put in `.env` as `MQTT_SERVER_PASSWORD`.

### 5.2 Add a device account

> **Note:** `scripts/provision-device.sh` is not yet implemented. Add
> accounts manually until the script is written.

For each STM32 device, add the account manually:

```bash
# -c creates the file; omit -c to append to an existing file
docker compose -f infra/docker-compose.prod.yml run --rm mosquitto \
  mosquitto_passwd /mosquitto/config/passwd qc-device-001a2b3c
```

Then append the ACL block for the device to `infra/mosquitto/acl.conf`
(see the template at the top of that file), and reload Mosquitto:

```bash
docker compose -f infra/docker-compose.prod.yml kill -s SIGHUP mosquitto
```

SIGHUP causes Mosquitto to reload its config and ACL without dropping
connections. Record the generated password — it is not stored anywhere
else; losing it requires re-provisioning the device.

When `scripts/provision-device.sh` is written, it will automate steps 1–4
and print credentials for the STM32 flashing tool:
1. Generate a random password
2. Append the account to `infra/mosquitto/passwd`
3. Append ACL entries to `infra/mosquitto/acl.conf`
4. Reload Mosquitto (SIGHUP — no dropped connections)
5. Print credentials to stdout

If Mosquitto is not yet running, you may add accounts manually:

```bash
docker compose -f infra/docker-compose.dev.yml run --rm mosquitto \
  mosquitto_passwd /mosquitto/config/passwd qc-device-001a2b3c
```

Then append the ACL block manually per the template in
`infra/mosquitto/acl.conf`.

### 5.3 Verify ACL coverage

After adding accounts, inspect `infra/mosquitto/acl.conf` and confirm:

- `qc-server` has `write qc/config/#`, `write qc/device/+/cmd`,
  `read qc/device/+/status`, `read qc/device/+/defect`
- Each device has `write qc/device/qc-stm32-<uid>/#`,
  `read qc/config/#`, `read qc/device/qc-stm32-<uid>/cmd`

A device must not have read access to another device's `/cmd` topic.
See `infra/mosquitto/acl.conf` for the authoritative policy.

---

## 6. Docker Compose Bring-Up

### Local development (laptop)

```bash
docker compose -f infra/docker-compose.dev.yml up --build
```

Services: `qc-server` (FastAPI :8000), `mosquitto` (:1883),
`qc-dashboard` (Caddy-served built SPA on :8080 / :443), and `dnsmasq` (host
network, RPi only — skip on a dev laptop). The dashboard image bundles Caddy;
there is no separate Vite-dev-server or Caddy service.

### Production (RPi)

```bash
# From dev laptop — GHCR images (requires images pushed by CI)
QC_VERSION=v0.1.0 ./scripts/deploy.sh user@<rpi-ip>

# From dev laptop — local build (no GHCR, builds from source on RPi)
BUILD_LOCAL=1 ./scripts/deploy.sh user@<rpi-ip>

# From the RPi itself (detected automatically when /etc/qc/.env exists)
QC_VERSION=v0.1.0 ./scripts/deploy.sh
```

Verify all services are healthy:

```bash
docker compose -f infra/docker-compose.prod.yml ps
```

All four services must show `healthy` before proceeding to device
provisioning.

### Re-publish retained config after a Mosquitto wipe

After a Mosquitto wipe or volume reset, the server's startup lifespan
re-publishes all retained config messages automatically. No manual
action needed; just restart the `server` container:

```bash
docker compose -f infra/docker-compose.prod.yml restart server
```

---

## 7. Andon Board — Wi-Fi Verification

The STM32 andon board joins Wi-Fi through an external **ESP-01 (ESP8266)** over
UART/AT commands (ADR-015) — the module owns the IP stack. Before mounting the
board on the wall, verify it can reach the server:

1. Flash the andon firmware (`C:\TouchGFXProjects\qc_node`) with the target
   SSID, PSK, and server host set in its Octo-SPI config.
2. Power on the board; the LCD should show a connecting → connected indicator.
3. Confirm it renders live KPI numbers (it is polling `GET /kpi`). A value other
   than the placeholder means the HTTP round-trip works.
4. If association fails: verify the AP serves 2.4 GHz, WPA2-PSK, and that client
   isolation is off; confirm the server host/IP in the board config is current.

The board is **display-only** — there is no input flow to test on the device
itself. Inspection is verified on a station tablet (section 8).

---

## 8. End-to-End Smoke Test

After bringing up the stack:

1. **Server healthy:**

   ```bash
   curl -f http://<rpi-ip>:8000/health        # → {"status":"ok"}
   ```

2. **Dashboard reachable:** Open `https://inspection.pmp` (or `http://<rpi-ip>:8080`)
   and log in as the `admin` user. Create a product with a couple of PMP /
   INJECTION defect types and an operator (note the one-time credentials).

3. **Inspection round-trip (the primary path):** On a tablet or any browser,
   open the inspection PWA (`/inspect.html`), log in with the operator's
   credentials, pick the product, tap a few defects across the grids, and
   submit. Confirm the part appears in the dashboard's **Journaux** and that the
   **Taux NC** updates. Toggle Wi-Fi off, log a part, toggle back on, and verify
   the queued part drains (online/pending indicator).

4. **Andon board:** Confirm the wall board's KPI numbers update within a few
   seconds of the inspection above (it polls `GET /kpi`).

5. **MQTT (only if using the optional MQTT KPI/config mirror):**

   ```bash
   mosquitto_sub -h <rpi-ip> -p 1883 -u qc-server -P <server-password> \
     -t 'qc/#' -v
   ```

   Should subscribe without error and show the retained `qc/display/kpi` /
   `qc/config/*` messages.

---

## 9. Operational Notes

- **Broker IP change:** If the RPi IP changes, every provisioned STM32
  must have its Octo-SPI config re-flashed. Prevent this by using a DHCP
  reservation or a static IP.
- **SSID or PSK rotation:** Similarly requires re-flashing all devices.
  Use a dedicated SSID with a stable PSK on a closed network segment
  to minimise rotation frequency.
- **Mosquitto restart:** Retained messages survive via the persistence DB
  (`mosquitto.db`). If the DB is deleted, restart the `server` container
  (section 6) — startup automatically re-publishes all retained config.
- **Adding a new device:** Run `scripts/provision-device.sh <uid>`, copy
  credentials to the flashing tool, flash the device. No broker restart
  required.
- **Offline queue:** lives in the **inspection PWA** (IndexedDB), not the
  andon board (which is display-only). Each tablet queues up to 1 000 parts
  during a Wi-Fi outage and drains them in order on reconnect — about 24 hours
  of typical use.

---

## 10. CI/CD Deployment Workflow

Images are built in GitHub Actions and pulled to the RPi — the RPi
never builds images itself (see ADR-012).

### Automated flow

1. **Code change** → push to any branch
   - `ci.yml` runs server pytest + ruff and dashboard vitest + tsc
2. **Merge to `main`**
   - `ci.yml` runs again
   - `build-images.yml` builds multi-arch images, pushes to ghcr.io
     tagged with `sha-<short>`, `main`, and `latest`
3. **Release**
   - `git tag v0.1.0 && git push --tags`
   - `build-images.yml` also tags the images as `v0.1.0`, `0.1`, and
     updates `latest`

### Deploy to RPi

```bash
# From dev laptop — pulls images and restarts the stack over SSH
QC_VERSION=v0.1.0 ./scripts/deploy.sh pi@<rpi-ip>

# From the RPi itself
QC_VERSION=v0.1.0 ./scripts/deploy.sh

# Rolling back to a previous version
QC_VERSION=v0.0.9 ./scripts/deploy.sh pi@<rpi-ip>
```

### One-time RPi setup

```bash
# On the RPi:
mkdir -p ~/qc-deploy
sudo mkdir -p /etc/qc
sudo cp .env.example /etc/qc/.env   # fill in production secrets
sudo chmod 600 /etc/qc/.env

# GHCR auth — generate a Personal Access Token at
# github.com/settings/tokens with read:packages scope
echo "$GHCR_PAT" | docker login ghcr.io -u <github-user> --password-stdin
```

The PAT is stored in `~/.docker/config.json` and does not expire
unless revoked. A single PAT per RPi is sufficient.

---

## 11. Development Environment (Devcontainer)

The repo ships with a VS Code devcontainer at `.devcontainer/`. Open the
repo in VS Code with the **Dev Containers** extension installed and choose
"Reopen in Container". This gives you Python 3.11, Node 20, GCC, and a
Mosquitto broker sidecar with zero host setup beyond Docker and VS Code.

See `.devcontainer/README.md` for the full task reference and
troubleshooting guide.

Firmware GUI tooling (STM32CubeIDE, TouchGFX Designer) remains on the
host — only the host-buildable C tests in `firmware/tests/` run
in-container.
