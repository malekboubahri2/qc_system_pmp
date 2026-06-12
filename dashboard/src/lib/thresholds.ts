// Alerting thresholds the QC responsable can tune (Settings). Stored client-side
// and evaluated in the dashboard from the live KPI it already streams — see
// hooks/useAppAlerts. Percentages.
export interface Thresholds {
  ncWarnPct: number; // global Taux NC % → warning
  ncCritPct: number; // global Taux NC % → critical
  productNcCritPct: number; // a single product's Taux NC % → critical
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  ncWarnPct: 5,
  ncCritPct: 10,
  productNcCritPct: 15,
};

// A product needs a real sample before it alone raises an alert (mirrors the
// andon board): 1 NC out of 1-2 parts shouldn't trip a critical.
export const PRODUCT_MIN_PARTS = 10;

const KEY = 'qc_thresholds';

export function getThresholds(): Thresholds {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_THRESHOLDS;
    return { ...DEFAULT_THRESHOLDS, ...(JSON.parse(raw) as Partial<Thresholds>) };
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}

export function setThresholds(t: Thresholds): void {
  localStorage.setItem(KEY, JSON.stringify(t));
}
