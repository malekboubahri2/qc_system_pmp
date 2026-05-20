import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Radio, Package, Users, ScrollText,
  LineChart, MonitorSmartphone, Settings, LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Icon } from '@/components/Icon';

// ── Hover/focus expand logic ─────────────────────────────────────────────────

function useSidebarHover() {
  const [isExpanded, setIsExpanded] = useState(false);
  return {
    isExpanded,
    onMouseEnter: () => setIsExpanded(true),
    onMouseLeave: () => setIsExpanded(false),
    onFocus: () => setIsExpanded(true),
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
        setIsExpanded(false);
      }
    },
  };
}

// ── Nav config ────────────────────────────────────────────────────────────────

const mainNav = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/stations/en-direct', label: 'Stations en direct', icon: Radio, end: false },
  { to: '/products', label: 'Produits', icon: Package, end: false },
  { to: '/operators', label: 'Opérateurs', icon: Users, end: false },
  { to: '/logs', label: 'Journaux', icon: ScrollText, end: false },
  { to: '/analytics', label: 'Analytique', icon: LineChart, end: false },
  { to: '/devices', label: 'Appareils', icon: MonitorSmartphone, end: false },
];

// ── NavItem ───────────────────────────────────────────────────────────────────

function NavItem({
  to, label, icon, end, isExpanded,
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  isExpanded: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center py-2.5 pl-5 pr-3 text-sm font-medium w-full',
          'transition-colors duration-150 border-l-2',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/60',
          isActive
            ? 'border-accent bg-brand/30 text-cream'
            : 'border-transparent text-cream/60 hover:text-cream hover:bg-brand/50',
        )
      }
    >
      <Icon icon={icon} size={20} className="flex-shrink-0" />
      <span
        className={cn(
          'ml-3 whitespace-nowrap overflow-hidden transition-[opacity,max-width] duration-200',
          isExpanded ? 'opacity-100 max-w-[160px]' : 'opacity-0 max-w-0',
        )}
      >
        {label}
      </span>
    </NavLink>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function Sidebar() {
  const { user, logout } = useAuth();
  const { isExpanded, onMouseEnter, onMouseLeave, onFocus, onBlur } = useSidebarHover();

  return (
    <aside
      className={cn(
        'flex-shrink-0 h-full flex flex-col bg-brand-deep overflow-hidden',
        'transition-[width] duration-200 ease-out',
        isExpanded ? 'w-[220px]' : 'w-16',
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-3 flex-shrink-0 border-b border-white/10">
        <img src="/logo.png" alt="PMP" className="w-10 h-10 object-contain flex-shrink-0" />
        <div
          className={cn(
            'ml-3 overflow-hidden transition-[opacity,max-width] duration-200',
            isExpanded ? 'opacity-100 max-w-[140px]' : 'opacity-0 max-w-0',
          )}
        >
          <p className="text-sm font-semibold text-cream leading-tight whitespace-nowrap">PMP</p>
          <p className="text-[10px] text-cream/60 leading-tight whitespace-nowrap">
            Peinture et Métallisation<br />sur Plastique
          </p>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 py-3 flex flex-col overflow-y-auto">
        {mainNav.map((item) => (
          <NavItem key={item.to} {...item} isExpanded={isExpanded} />
        ))}
      </nav>

      {/* Footer — Paramètres + logout */}
      <div className="py-3 flex flex-col border-t border-white/10 flex-shrink-0">
        <NavItem to="/settings" label="Paramètres" icon={Settings} isExpanded={isExpanded} />

        {user && (
          <button
            onClick={logout}
            title="Déconnexion"
            className={cn(
              'flex items-center py-2.5 pl-5 pr-3 text-sm w-full',
              'text-cream/60 hover:text-cream hover:bg-brand/50 transition-colors duration-150',
              'border-l-2 border-transparent focus:outline-none',
            )}
          >
            <Icon icon={LogOut} size={20} className="flex-shrink-0" />
            <span
              className={cn(
                'ml-3 whitespace-nowrap overflow-hidden transition-[opacity,max-width] duration-200 text-left',
                isExpanded ? 'opacity-100 max-w-[160px]' : 'opacity-0 max-w-0',
              )}
            >
              {user.email}
            </span>
          </button>
        )}
      </div>
    </aside>
  );
}
