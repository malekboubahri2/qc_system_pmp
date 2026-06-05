import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PanelHeaderProps {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  className?: string;
}

/**
 * Brand-teal header strip (h-20 bg-brand).
 * Used by Stations panels; accepts three optional layout slots.
 */
export function PanelHeader({ left, center, right, className }: PanelHeaderProps) {
  return (
    <header
      className={cn(
        'h-20 bg-brand text-ink-inv px-6 flex items-center gap-5',
        'sticky top-0 z-10',
        className,
      )}
    >
      {left && <div className="flex flex-col min-w-0">{left}</div>}
      {center && <div className="flex-1 flex justify-center">{center}</div>}
      {right && <div className="text-right flex flex-col items-end gap-0.5">{right}</div>}
    </header>
  );
}
