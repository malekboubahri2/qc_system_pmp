export interface ProductOperatorView {
  id: number | null;
  name: string;
  initial: string;
  parts: number;
  ncParts: number;
  ncRatePct: string;   // "12.5%"
  active: boolean;
  lastAgo: string;
}

export interface ProductFeedView {
  id: number;
  label: string;
  category: string;
  note?: string;
  operatorName: string;
  ago: string;
  isOther: boolean;
}

export interface ProductView {
  id: number;
  name: string;
  reference?: string;
  client?: string;
  active: boolean;
  lastAgo: string;
  partsToday: number;
  ncParts: number;
  okParts: number;
  defectCount: number;
  ncRatePct: string;     // "12.5%"
  ncRateDir: 'up' | 'flat';
  lastHourParts: number;
  activeOperators: number;
  operators: ProductOperatorView[];
  feed: ProductFeedView[];
}
