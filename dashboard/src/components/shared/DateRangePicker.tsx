import { cn } from '@/lib/utils';

interface DateRangePickerProps {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  className?: string;
}

const inputClass = cn(
  'bg-white border border-cream-subtle rounded-lg px-3 py-2 text-sm text-ink font-mono',
  'transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent',
);

export function DateRangePicker({ from, to, onFromChange, onToChange, className }: DateRangePickerProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <label className="text-xs font-medium text-ink-muted whitespace-nowrap">Du</label>
      <input
        type="date"
        value={from}
        onChange={(e) => onFromChange(e.target.value)}
        className={inputClass}
        max={to || undefined}
      />
      <label className="text-xs font-medium text-ink-muted whitespace-nowrap">au</label>
      <input
        type="date"
        value={to}
        onChange={(e) => onToChange(e.target.value)}
        className={inputClass}
        min={from || undefined}
      />
    </div>
  );
}

// Utility: ISO date string for N days ago
export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
