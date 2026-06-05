import { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { useServerEvents } from '@/hooks/useServerEvents';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  useServerEvents();  // live refresh on new inspections (SSE)
  return (
    <div className="h-screen bg-cream flex overflow-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 h-full overflow-y-auto">
        {/* Consistent app-wide gutters: generous top so the page header never
            sits flush against the viewport, even-handed horizontal padding. */}
        <div className="px-6 sm:px-8 lg:px-12 pt-12 pb-14 min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
