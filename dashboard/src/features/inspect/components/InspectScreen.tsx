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
    // Pad for the device safe areas (notch / status bar / home indicator).
    // inspect.html uses viewport-fit=cover + a translucent status bar, so
    // without this the header renders *under* the status bar in fullscreen.
    <div
      className="h-dvh flex flex-col bg-cream"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <header className="flex items-center justify-between gap-4 px-[clamp(1.25rem,4vw,2.5rem)] pt-[clamp(1rem,2.5vh,1.75rem)] pb-[clamp(0.75rem,1.5vh,1.25rem)] shrink-0">
        <div className="min-w-0">
          {title && (
            <h1 className="text-fluid-xl font-bold text-brand tracking-tighter truncate">{title}</h1>
          )}
          {subtitle && <p className="text-fluid-sm text-ink-muted mt-0.5 truncate">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-[clamp(0.75rem,2vw,1.5rem)] shrink-0">
          {action}
          <ConnectivityBadge />
          <Clock />
        </div>
      </header>

      <main
        className={[
          'flex-1 min-h-0 px-[clamp(1.25rem,4vw,2.5rem)] pb-[clamp(1rem,2vh,1.5rem)]',
          fill ? 'overflow-hidden' : 'overflow-y-auto',
        ].join(' ')}
      >
        <div className="h-full animate-fade-in-up">{children}</div>
      </main>

      {footer && (
        <footer className="shrink-0 px-[clamp(1.25rem,4vw,2.5rem)] py-[clamp(0.875rem,2vh,1.25rem)] bg-cream/95 backdrop-blur border-t border-cream-subtle">
          {footer}
        </footer>
      )}
    </div>
  );
}
