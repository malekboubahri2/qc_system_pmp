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
   ─────────────────────────────────────────────────
   │                                             │
[RPi 4B]                               [STM32H7B3I-DK]
static IP / DHCP reservation            ISM43340 Wi-Fi module
runs Mosquitto on :1883
```

The RPi connects to the plant AP via its wired Ethernet (recommended) or its
own Wi-Fi interface. The STM32 connects to the same AP over 2.4 GHz (the
ISM43340 is 2.4 GHz only; the AP must serve a 2.4 GHz band on the chosen
SSID).

Both devices must be on the same Layer-3 subnet so MQTT traffic (TCP :1883)
is routed directly. No VPN or NAT between them.

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

---

## 2. Plant IT Requirements (Option A)

Before arrival at the site, confirm these items with the plant IT contact:

| Requirement | Why |
|---|---|
| STM32 on 2.4 GHz SSID | ISM43340 is 802.11 b/g/n; no 5 GHz support |
| Client isolation **off** | STM32 must reach the RPi over WLAN; isolation blocks it |
| TCP port **1883** open between WLAN clients | Mosquitto; no TLS in PoC |
| WPA2-PSK (not 802.1X/enterprise) | ISM43340 AT-command driver does not implement EAP |
| Static IP **or** DHCP reservation for the RPi | STM32 firmware has the broker IP baked in; it must not change |
| RSSI ≥ −65 dBm at every inspection station | ISM43340 reliable-operation floor; painting equipment is electrically noisy |

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
`qc-dashboard` (Vite dev server :5173), `caddy` (:80).

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

## 7. STM32 Device — Wi-Fi Verification

Before flashing production firmware, verify that the ISM43340 can join the
target SSID using the Clock & Weather demo shipped with the H7B3I-DK board.

1. Download and flash the Clock & Weather demo from STM32CubeH7 examples.
2. Configure the demo's `wifi_credentials.h` with the target SSID and PSK.
3. Power on the board and check the LCD for a connected status and IP address.
4. If association fails: verify the AP serves 2.4 GHz, WPA2-PSK, and that
   client isolation is off.

A successful Clock & Weather demo association is the Day 1 gate before
any firmware development begins (see `docs/roadmap.md` Day 1 checklist).

---

## 8. End-to-End Smoke Test

After bringing up the stack and flashing a device:

1. **MQTT broker reachable:**

   ```bash
   # From the RPi or another machine on the same subnet
   mosquitto_sub -h <rpi-ip> -p 1883 -u qc-server -P <server-password> \
     -t 'qc/#' -v
   ```

   Should subscribe without error. Leave it running.

2. **Device connects:** Power on the STM32. Within 30 seconds you should
   see a connect message in the Mosquitto log (`connection_messages true`)
   and a heartbeat on `qc/device/qc-stm32-<uid>/status`.

3. **Config delivery:** The device should receive the retained
   `qc/config/products` and `qc/config/operators` messages immediately on
   connect. Verify via the `mosquitto_sub` terminal above.

4. **Defect log round-trip:** Tap a defect on the STM32 touchscreen.
   Verify the log appears in `mosquitto_sub` on `qc/device/<id>/defect`
   and in the FastAPI database (`GET /api/v1/logs`).

5. **Dashboard:** Open `http://<rpi-ip>` in a browser. Log in. Confirm
   the defect appears in the live log view.

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
- **Device offline queue:** Each STM32 queues up to 1 000 defect logs to
  Octo-SPI flash during Wi-Fi outages and drains them on reconnect. This
  covers approximately 24 hours of typical plant use.

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
