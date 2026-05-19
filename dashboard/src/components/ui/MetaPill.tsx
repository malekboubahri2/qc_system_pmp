import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MetaPillProps {
  children: ReactNode;
  className?: string;
}

/**
 * "Mis à jour à HH:MM" live-update indicator.
 * Green pulsing dot + text. Matches .meta-pill from Frame 1.
 */
export function MetaPill({ children, className }: MetaPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 px-3.5 py-2 bg-white rounded-full text-xs text-ink-muted tracking-wide',
        className,
      )}
      style={{ boxShadow: '0 1px 3px rgba(26,85,96,0.08),0 1px 2px rgba(26,85,96,0.04)' }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full bg-success flex-shrink-0 animate-livepulse"
        style={{ boxShadow: '0 0 0 3px rgba(46,125,91,0.18)' }}
      />
      {children}
    </span>
  );
}
