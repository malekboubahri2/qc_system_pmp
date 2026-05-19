import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
}

/** Centred empty-state: icon + heading + optional sub. */
export function EmptyState({ icon: Icon, title, description, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      <Icon size={32} strokeWidth={1.5} className="text-ink-muted opacity-40" />
      <p className="text-base font-semibold text-ink-head mt-3">{title}</p>
      {description && <p className="text-sm text-ink-muted mt-1 max-w-xs">{description}</p>}
    </div>
  );
}
