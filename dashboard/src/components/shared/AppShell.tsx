import { type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useServerEvents } from '@/hooks/useServerEvents';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  useServerEvents();  // live refresh on new inspections (SSE)
  const { pathname } = useLocation();
  return (
    <div className="h-screen bg-cream flex overflow-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 h-full overflow-y-auto">
        {/* Consistent app-wide gutters: generous top so the page header never
            sits flush against the viewport, even-handed horizontal padding. */}
        <div className="px-6 sm:px-8 lg:px-12 pt-12 pb-14 min-h-full">
          {/* Keyed by route so each page fades in on navigation. */}
          <div key={pathname} className="animate-fade-in-up">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
