import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  Layers,
  Users,
  FileText,
  BarChart2,
  Cpu,
  Settings,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Icon } from '@/components/Icon';

const mainNav = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/stations/en-direct', label: 'Stations en direct', icon: Activity, end: false },
  { to: '/products', label: 'Produits', icon: Layers, end: false },
  { to: '/operators', label: 'Opérateurs', icon: Users, end: false },
  { to: '/logs', label: 'Journaux', icon: FileText, end: false },
  { to: '/analytics', label: 'Analytique', icon: BarChart2, end: false },
  { to: '/devices', label: 'Appareils', icon: Cpu, end: false },
];

function NavItem({
  to,
  label,
  icon,
  end,
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
          isActive
            ? 'text-accent bg-white/10'
            : 'text-ink-inverse/70 hover:text-ink-inverse hover:bg-white/5',
        )
      }
    >
      <Icon icon={icon} size={18} />
      {label}
    </NavLink>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col bg-brand-deep">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-white/10 flex-shrink-0">
        <img src="/logo.png" alt="PMP" className="h-14 w-auto" />
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 py-5 flex flex-col gap-1 overflow-y-auto">
        {mainNav.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      {/* Bottom section */}
      <div className="px-3 py-4 border-t border-white/10 flex-shrink-0 flex flex-col gap-1">
        <NavItem to="/settings" label="Paramètres" icon={Settings} />

        {/* User + logout */}
        {user && (
          <div className="px-3 pt-2 pb-1 flex items-center justify-between">
            <span className="text-xs text-ink-inverse/50 truncate">{user.email}</span>
            <button
              onClick={logout}
              title="Déconnexion"
              className="text-ink-inverse/50 hover:text-ink-inverse transition-colors ml-2 flex-shrink-0"
            >
              <Icon icon={LogOut} size={15} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
