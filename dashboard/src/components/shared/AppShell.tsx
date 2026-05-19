import { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="h-screen bg-cream overflow-hidden">
      <Sidebar />
      {/* ml-16 = 64px to match the collapsed sidebar width */}
      <main className="ml-16 h-full overflow-y-auto">
        <div className="px-8 md:px-10 lg:px-12 py-10 min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
