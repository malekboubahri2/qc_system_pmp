// The last account that signed in, kept so a quick re-login (after an idle
// auto-logout on the kiosk) only asks for the password. Shared by the admin
// login page and the inspection PWA (same origin → same localStorage).
const ID_KEY = 'qc_last_user';
const NAME_KEY = 'qc_last_user_name';

export interface RememberedUser {
  identifier: string; // e-mail (admin) or matricule/username (operator)
  name: string; // display name
}

export function rememberUser(identifier: string, name: string): void {
  localStorage.setItem(ID_KEY, identifier);
  localStorage.setItem(NAME_KEY, name || identifier);
}

export function getRememberedUser(): RememberedUser | null {
  const identifier = localStorage.getItem(ID_KEY);
  if (!identifier) return null;
  return { identifier, name: localStorage.getItem(NAME_KEY) || identifier };
}

export function forgetUser(): void {
  localStorage.removeItem(ID_KEY);
  localStorage.removeItem(NAME_KEY);
}
