import { type ReactNode, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';

interface PanelProps {
  children: ReactNode;
  className?: string;
  /** Set to true for Stations-style full-height panels */
  minHeight?: boolean;
}

/** White rounded-lg container matching the .panel spec from Frame 1. */
export function Panel({ children, className, minHeight }: PanelProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-lg overflow-hidden flex flex-col',
        minHeight && 'min-h-[760px]',
        className,
      )}
      style={{ boxShadow: '0 1px 3px rgba(26,85,96,0.08),0 1px 2px rgba(26,85,96,0.04)' }}
    >
      {children}
    </div>
  );
}

export function PanelBody({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={cn('flex-1 overflow-y-auto', className)} style={style}>
      {children}
    </div>
  );
}

export function PanelFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <footer className={cn('h-10 bg-cream-sub px-5 flex items-center justify-between text-xs text-ink-muted', className)}>
      {children}
    </footer>
  );
}
