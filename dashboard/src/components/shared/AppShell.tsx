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
        <div className="px-8 md:px-10 lg:px-12 py-10 min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
