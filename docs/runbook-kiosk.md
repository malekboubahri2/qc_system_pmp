# Runbook — station tablet kiosk (HTTPS + lock)

How to turn a station tablet into a locked-down, always-on kiosk running the
inspection PWA over HTTPS. Do this once per tablet.

The PWA only becomes *installable* and works *offline* (service worker) and
keeps the screen on (wake lock) over a **secure context** — i.e. HTTPS, or
`localhost`. The stack serves HTTPS on port 443 using Caddy's built-in
("internal") certificate authority. The browser must trust that CA first.

## 1. Trust the server's root certificate

The Pi's IP changes between networks, so the stack issues certificates on
demand from a single, stable root CA. Install that root once; every IP it later
serves is then trusted.

Export the root certificate from the Pi:

```bash
ssh user@<pi-ip> \
  'docker exec infra-qc-dashboard-1 cat /data/caddy/pki/authorities/local/root.crt' \
  > qc-root-ca.crt
```

Get `qc-root-ca.crt` onto the tablet (email, USB, or a download), then on the
tablet:

- **Android:** Settings → Security → *Encryption & credentials* → *Install a
  certificate* → *CA certificate* → pick `qc-root-ca.crt`.
- **iPadOS:** open the file → install the profile (Settings → General → VPN &
  Device Management), then Settings → General → About → *Certificate Trust
  Settings* and enable full trust for it.

After this, `https://<pi-ip>/` loads with no warning.

## 2. Install the PWA

In the tablet browser, open the inspection app over HTTPS:

```
https://<pi-ip>/inspect.html
```

Then use the browser menu → **Add to Home screen** / **Install app**. It
installs full-screen with no browser chrome. Sign in once with the operator's
username + password (operators are created in the dashboard, which mints the
credentials and shows them once).

> Plain HTTP still works at `http://<pi-ip>:8080/` for quick checks, but it is
> **not** installable and has no offline app-load or wake-lock.

## 3. Name the station

Each tablet reports a station name shown in *Stations en direct*. To set a
custom one, in the browser console on the PWA:

```js
localStorage.setItem('qc_device_name', 'Poste Peinture 1')
```

(Without this it defaults to a label derived from the device's user-agent.)

## 4. Lock it down (kiosk mode)

Pick one:

- **Android, simplest** — *Screen pinning*: Settings → Security → *App pinning*,
  then pin the installed PWA. Exiting needs the PIN.
- **Android, robust** — a managed-kiosk launcher (e.g. *Fully Kiosk Browser*):
  set the start URL to `https://<pi-ip>/inspect.html`, enable kiosk mode, screen
  always-on, and motion/clock as wanted.
- **Org-managed fleet** — your MDM's kiosk/single-app policy pointing at the PWA.

The screen wake-lock is automatic while the PWA is open (secure context only),
so the display won't sleep mid-shift. A managed-kiosk launcher's "keep screen
on" is a good belt-and-braces backup.

## 5. Mount

Use a **powered** wall/stand mount so the tablet is always charging — kiosks run
all shift. Verify Wi-Fi RSSI at the station is comfortably above the tablet's
reliable threshold (painting equipment is electrically noisy).

## Notes

- The root CA lives on the `caddy-data` Docker volume and survives restarts, so
  you only trust it once even as the Pi's IP changes.
- On a new tablet, repeat sections 1, 2, 4.
