import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Crumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  breadcrumb: Crumb[];
  title: string;
  subtitle?: string;
  right?: ReactNode;
  className?: string;
}

/**
 * Page-level header: breadcrumb / title / subtitle + optional right slot.
 * Matches .topbar + h1.page-title + .page-sub from Frame 1.
 */
export function PageHeader({ breadcrumb, title, subtitle, right, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-baseline justify-between gap-6 mb-6', className)}>
      <div>
        <div className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-1">
          {breadcrumb.map((crumb, i) => (
            <span key={i}>
              {i > 0 && <span className="mx-2 opacity-50">/</span>}
              {crumb.href ? (
                <Link to={crumb.href} className="hover:text-brand transition-colors">
                  {crumb.label}
                </Link>
              ) : i === breadcrumb.length - 1 ? (
                <span className="text-brand">{crumb.label}</span>
              ) : (
                <span>{crumb.label}</span>
              )}
            </span>
          ))}
        </div>
        <h1 className="text-3xl font-bold text-ink-head leading-tight tracking-tighter m-0">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-ink-muted mt-1">{subtitle}</p>}
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}
