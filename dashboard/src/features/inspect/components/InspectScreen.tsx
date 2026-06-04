import type { ReactNode } from 'react';

interface InspectScreenProps {
  title?: string;
  subtitle?: string;
  /** Top-right slot (e.g. station status, logout). */
  action?: ReactNode;
  /** Bottom sticky bar (e.g. primary CTA). */
  footer?: ReactNode;
  children: ReactNode;
}

// Full-screen, touch-first layout for the inspection kiosk. No admin chrome.
export function InspectScreen({
  title, subtitle, action, footer, children,
}: InspectScreenProps) {
  return (
    <div className="min-h-dvh flex flex-col bg-cream">
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
          <div>
            {title && (
              <h1 className="text-2xl font-bold text-brand tracking-tighter">{title}</h1>
            )}
            {subtitle && <p className="text-ink-muted mt-1">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}

      <main className="flex-1 px-6 pb-6 overflow-y-auto">{children}</main>

      {footer && (
        <footer className="sticky bottom-0 px-6 py-4 bg-cream/95 backdrop-blur border-t border-cream-subtle">
          {footer}
        </footer>
      )}
    </div>
  );
}
