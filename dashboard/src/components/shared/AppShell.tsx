import { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="h-screen flex overflow-hidden" style={{ background: '#FAEEE3' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="px-6 md:px-8 lg:px-10 py-8 min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
