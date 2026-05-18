import { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="h-screen flex overflow-hidden bg-cream">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="px-8 md:px-10 lg:px-12 py-10 min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
