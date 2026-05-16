import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
}

export function Card({ elevated, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-lg',
        elevated ? 'shadow-elevated' : 'shadow-card',
        className,
      )}
      style={{
        boxShadow: elevated
          ? '0 4px 12px rgba(26, 85, 96, 0.12)'
          : '0 1px 3px rgba(26, 85, 96, 0.08), 0 1px 2px rgba(26, 85, 96, 0.04)',
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-6 py-4 border-b border-cream-subtle', className)} {...props}>
      {children}
    </div>
  );
}

export function CardBody({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-6', className)} {...props}>
      {children}
    </div>
  );
}
