import { cn } from '@/lib/utils';

type Status = 'success' | 'warning' | 'danger' | 'info';

interface StatusBadgeProps {
  status: Status;
  label: string;
  dot?: boolean;
  className?: string;
}

const statusStyles: Record<Status, { badge: string; dot: string }> = {
  success: {
    badge: 'bg-success/10 text-success',
    dot: 'bg-success',
  },
  warning: {
    badge: 'bg-warning/10 text-warning',
    dot: 'bg-warning',
  },
  danger: {
    badge: 'bg-danger/10 text-danger',
    dot: 'bg-danger',
  },
  info: {
    badge: 'bg-info/10 text-info',
    dot: 'bg-info',
  },
};

export function StatusBadge({ status, label, dot = true, className }: StatusBadgeProps) {
  const styles = statusStyles[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium',
        styles.badge,
        className,
      )}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', styles.dot)} />}
      {label}
    </span>
  );
}
