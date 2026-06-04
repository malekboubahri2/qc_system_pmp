import type { ReactNode } from 'react';
import { ConnectivityBadge } from './ConnectivityBadge';
import { Clock } from './Clock';

interface InspectScreenProps {
  title?: string;
  subtitle?: string;
  /** Top-right slot (e.g. back/logout). The clock + connectivity are always shown. */
  action?: ReactNode;
  /** Bottom sticky bar (e.g. primary CTA). */
  footer?: ReactNode;
  /** Fill the viewport without scrolling (defect grids). Default allows scroll. */
  fill?: boolean;
  children: ReactNode;
}

// Full-screen, touch-first layout for the inspection kiosk. No admin chrome.
export function InspectScreen({
  title, subtitle, action, footer, fill = false, children,
}: InspectScreenProps) {
  return (
    <div className="h-dvh flex flex-col bg-cream">
      <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-3 shrink-0">
        <div className="min-w-0">
          {title && (
            <h1 className="text-2xl font-bold text-brand tracking-tighter truncate">{title}</h1>
          )}
          {subtitle && <p className="text-ink-muted mt-0.5 truncate">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {action}
          <ConnectivityBadge />
          <Clock />
        </div>
      </header>

      <main className={['flex-1 min-h-0 px-6 pb-4', fill ? 'overflow-hidden' : 'overflow-y-auto'].join(' ')}>
        {children}
      </main>

      {footer && (
        <footer className="shrink-0 px-6 py-4 bg-cream/95 backdrop-blur border-t border-cream-subtle">
          {footer}
        </footer>
      )}
    </div>
  );
}
