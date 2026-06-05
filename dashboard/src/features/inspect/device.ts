// Per-tablet identity for the inspection PWA.
//
// Browsers can't read the OS device name (privacy), so each tablet gets a
// stable random id on first run and a friendly name it reports to the server.
// The name defaults to a best-effort user-agent label and can be overridden
// (kiosk setup) by setting `qc_device_name` in localStorage.

const ID_KEY = 'qc_device_id';
const NAME_KEY = 'qc_device_name';

function rand8hex(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const b = new Uint8Array(4);
    crypto.getRandomValues(b);
    return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  }
  return Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
}

export function getDeviceId(): string {
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = `qc-web-${rand8hex()}`;
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}

function defaultName(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Tablette Android';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/Windows/.test(ua)) return 'PC Windows';
  if (/Macintosh/.test(ua)) return 'Mac';
  return 'Poste';
}

export function getDeviceName(): string {
  return localStorage.getItem(NAME_KEY) || defaultName();
}

export function setDeviceName(name: string): void {
  localStorage.setItem(NAME_KEY, name);
}
