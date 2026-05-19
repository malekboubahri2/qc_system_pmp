import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionProps {
  title?: string;
  children: ReactNode;
  className?: string;
  /** Right-side slot (e.g. a button or count badge) */
  action?: ReactNode;
}

/** Generic page-section wrapper: bg-white rounded-lg shadow-rest p-6. */
export function Section({ title, children, className, action }: SectionProps) {
  return (
    <section
      className={cn('bg-white rounded-lg p-6', className)}
      style={{ boxShadow: '0 1px 3px rgba(26,85,96,0.08),0 1px 2px rgba(26,85,96,0.04)' }}
    >
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="text-xl font-semibold text-ink-head">{title}</h2>}
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
