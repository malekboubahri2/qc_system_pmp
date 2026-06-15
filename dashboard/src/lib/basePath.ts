// The app is served under a configurable base path (Vite `base`, e.g. "/level3/").
// `import.meta.env.BASE_URL` carries it (always with a trailing slash). These
// helpers keep the base path in exactly one place — use them for hard
// navigations (`window.location`) and the router basename, never a bare "/".
const BASE = import.meta.env.BASE_URL; // "/" at root, "/level3/" under a subpath

/**
 * Absolute URL for an app path, honouring the configured base.
 * `appUrl('login')` → "/level3/login"; `appUrl()` → "/level3/".
 */
export function appUrl(path = ''): string {
  return BASE + path.replace(/^\/+/, '');
}

/** Router basename derived from the base (no trailing slash; "/" at root). */
export const routerBasename = BASE.replace(/\/+$/, '') || '/';
