import { cn } from '@/lib/utils';

interface RateCellProps {
  rate: number;   // 0.0 – 1.0
  total: number;
}

function rateColor(rate: number): string {
  if (rate === 0) return 'text-success';
  if (rate < 0.10) return 'text-warning';
  return 'text-danger';
}

export function RateCell({ rate, total }: RateCellProps) {
  if (total === 0) {
    return <span className="text-ink-muted/40 tabular-nums">—</span>;
  }
  const pct = (rate * 100).toFixed(1);
  return (
    <span className={cn('tabular-nums font-medium', rateColor(rate))}>
      {pct}%
    </span>
  );
}
