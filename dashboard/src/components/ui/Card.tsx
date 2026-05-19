import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type CardVariant = 'default' | 'fallback' | 'historical';

interface CardProps {
  variant?: CardVariant;
  /** Badge rendered absolutely at top-right (e.g. "↻ 3 répétés") */
  repeatBadge?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Feed-row card matching .card from Frame 1.
 *
 * - default:    white, items-center, horizontal layout
 * - fallback:   adds border-l-2 border-accent + items-start (for note text)
 * - historical: same as default but 60% opacity (offline station history)
 *
 * Expected children: <CardGlyph>, <CardBody>, <CardRight>
 */
export function Card({ variant = 'default', repeatBadge, children, className }: CardProps) {
  return (
    <article
      className={cn(
        'bg-white rounded-md p-4 flex gap-3.5 relative',
        'shadow-[0_1px_3px_rgba(26,85,96,0.08),0_1px_2px_rgba(26,85,96,0.04)]',
        variant === 'default' && 'items-center',
        variant === 'fallback' && 'items-start border-l-2 border-accent pl-3.5',
        variant === 'historical' && 'items-center opacity-60',
        className,
      )}
    >
      {repeatBadge && (
        <span className="absolute top-2.5 right-3.5 text-xs text-ink-muted tracking-[0.01em]">
          {repeatBadge}
        </span>
      )}
      {children}
    </article>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex-1 min-w-0', className)}>{children}</div>;
}

export function CardRight({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('text-right flex-shrink-0 flex flex-col items-end gap-1.5', className)}>
      {children}
    </div>
  );
}
