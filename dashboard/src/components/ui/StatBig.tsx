import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Trend {
  label: string;
  direction?: 'up' | 'down' | 'flat';
}

interface StatBigProps {
  label: string;
  value: number | string;
  trend?: Trend;
  className?: string;
}

const TREND_ICON = {
  up:   TrendingUp,
  down: TrendingDown,
  flat: Minus,
};

const TREND_COLOR = {
  up:   'text-success',
  down: 'text-danger',
  flat: 'text-ink-muted',
};

/**
 * Large stat number with label and optional trend line.
 * Matches .big-stat + .trend from Frame 1.
 */
export function StatBig({ label, value, trend, className }: StatBigProps) {
  const dir = trend?.direction ?? 'up';
  const TrendIcon = TREND_ICON[dir];
  return (
    <div className={cn('flex flex-col', className)}>
      <span className="text-xs font-medium uppercase tracking-wider text-ink-muted leading-none">
        {label}
      </span>
      <span className="text-4xl font-bold text-ink-head leading-none tracking-tightest tnum mt-2">
        {value}
      </span>
      {trend && (
        <span className={cn('flex items-center gap-1.5 text-xs text-ink-muted mt-1.5', TREND_COLOR[dir])}>
          <TrendIcon size={12} strokeWidth={1.5} />
          {trend.label}
        </span>
      )}
    </div>
  );
}
