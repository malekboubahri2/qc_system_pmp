declare global {
  interface Window {
    __APP_CONFIG__?: {
      apiBaseUrl?: string;
      plantName?: string;
      locale?: string;
    };
  }
}

export const config = {
  apiBaseUrl: window.__APP_CONFIG__?.apiBaseUrl ?? '/api',
  plantName: window.__APP_CONFIG__?.plantName ?? 'Plant 1',
  locale: window.__APP_CONFIG__?.locale ?? 'fr-TN',
} as const;
