export interface StationSession {
  operatorInitial: string;
  operatorName: string;
  connectedAt: string;
  productName: string;
  productRef: string;
  defectCount: number;
  okCount: number;
  trendLabel: string;
  trendDirection: 'up' | 'flat' | 'down';
}

export interface FeedEntry {
  id: number;
  label: string;
  category: string;
  note?: string;
  productRef: string;
  ago: string;
  isOther?: boolean;
  repeatCount?: number;
}

export interface StationView {
  id: string;
  name: string;
  deviceId: string;
  online: boolean;
  connSince: string;
  sessionActive: boolean;
  session: StationSession;
  feed: FeedEntry[];
  visibleCount: number;
  todayCount: number;
}
