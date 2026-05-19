import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'success' | 'idle' | 'warning' | 'danger' | 'info';
type Tone = 'on-light' | 'on-dark';

interface PillProps {
  variant?: Variant;
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

const LIGHT: Record<Variant, { pill: string; dot: string }> = {
  success: { pill: 'bg-success/10 text-success',   dot: 'bg-success' },
  idle:    { pill: 'bg-cream-sub text-ink-muted',   dot: 'bg-ink-muted/40' },
  warning: { pill: 'bg-warning/10 text-warning',    dot: 'bg-warning' },
  danger:  { pill: 'bg-danger/10 text-danger',      dot: 'bg-danger' },
  info:    { pill: 'bg-info/10 text-info',           dot: 'bg-info' },
};

const DARK: Record<Variant, { pill: string; dot: string }> = {
  success: { pill: 'bg-success/[0.22] text-[#C8EBD9]',          dot: 'bg-[#6BD4A4]' },
  idle:    { pill: 'bg-cream/10 text-ink-inv/60',                dot: 'bg-cream/45' },
  warning: { pill: 'bg-warning/20 text-[#f5c97a]',              dot: 'bg-warning' },
  danger:  { pill: 'bg-danger/20 text-[#f5a0a0]',               dot: 'bg-danger' },
  info:    { pill: 'bg-info/20 text-[#b3d9e0]',                 dot: 'bg-info' },
};

/**
 * Status pill matching the .session-badge spec from Frame 1.
 * tone="on-dark" for use inside PanelHeader (teal bg).
 * tone="on-light" (default) for use on cream/white backgrounds.
 */
export function Pill({ variant = 'idle', tone = 'on-light', dot, children, className }: PillProps) {
  const map = tone === 'on-dark' ? DARK : LIGHT;
  const { pill, dot: dotCls } = map[variant];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium tracking-wide',
        pill,
        className,
      )}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dotCls)} />}
      {children}
    </span>
  );
}
