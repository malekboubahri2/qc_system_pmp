import {
  createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode,
} from 'react';
import {
  Bell, X, Info, CheckCircle2, AlertTriangle, AlertCircle, Trash2,
} from 'lucide-react';
import { config } from '@/config';

export type NotifLevel = 'info' | 'success' | 'warning' | 'critical';

export interface AppNotif {
  id: string;
  level: NotifLevel;
  title: string;
  message?: string;
  at: number;
  read: boolean;
}

interface NotifyInput {
  level: NotifLevel;
  title: string;
  message?: string;
  /** De-dupe key: the same key won't re-fire within `cooldownMs`. */
  key?: string;
  cooldownMs?: number;
}

interface Ctx {
  items: AppNotif[];
  toasts: AppNotif[];
  unread: number;
  notify: (n: NotifyInput) => void;
  dismissToast: (id: string) => void;
  remove: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

const NotificationsCtx = createContext<Ctx | null>(null);
const TOAST_MS = 60_000; // a toast lingers ~1 min, then drops to the center only
const MAX = 50;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<AppNotif[]>([]);
  const [toastIds, setToastIds] = useState<string[]>([]);
  const lastFired = useRef<Map<string, number>>(new Map());

  const notify = useCallback((n: NotifyInput) => {
    const now = Date.now();
    if (n.key) {
      const prev = lastFired.current.get(n.key);
      if (prev && now - prev < (n.cooldownMs ?? 5 * 60_000)) return;
      lastFired.current.set(n.key, now);
    }
    const id = globalThis.crypto?.randomUUID?.() ?? `${now}-${Math.random()}`;
    const notif: AppNotif = { id, level: n.level, title: n.title, message: n.message, at: now, read: false };
    setItems((cur) => [notif, ...cur].slice(0, MAX));
    setToastIds((cur) => [id, ...cur]);
    setTimeout(() => setToastIds((cur) => cur.filter((x) => x !== id)), TOAST_MS);
  }, []);

  const dismissToast = useCallback((id: string) => setToastIds((cur) => cur.filter((x) => x !== id)), []);
  const remove = useCallback((id: string) => {
    setItems((cur) => cur.filter((x) => x.id !== id));
    setToastIds((cur) => cur.filter((x) => x !== id));
  }, []);
  const markAllRead = useCallback(() => setItems((cur) => cur.map((x) => ({ ...x, read: true }))), []);
  const clearAll = useCallback(() => { setItems([]); setToastIds([]); }, []);

  const toasts = useMemo(() => items.filter((i) => toastIds.includes(i.id)), [items, toastIds]);
  const unread = items.reduce((n, i) => n + (i.read ? 0 : 1), 0);

  const value = useMemo<Ctx>(
    () => ({ items, toasts, unread, notify, dismissToast, remove, markAllRead, clearAll }),
    [items, toasts, unread, notify, dismissToast, remove, markAllRead, clearAll],
  );

  return <NotificationsCtx.Provider value={value}>{children}</NotificationsCtx.Provider>;
}

export function useNotifications(): Ctx {
  const ctx = useContext(NotificationsCtx);
  if (!ctx) throw new Error('useNotifications must be used within <NotificationProvider>');
  return ctx;
}

// ── presentation ────────────────────────────────────────────────────────────
const ICON = { info: Info, success: CheckCircle2, warning: AlertTriangle, critical: AlertCircle } as const;
const BORDER = { info: 'border-l-brand', success: 'border-l-success', warning: 'border-l-warning', critical: 'border-l-danger' } as const;
const TINT = { info: 'text-brand', success: 'text-success', warning: 'text-warning', critical: 'text-danger' } as const;

function timeAgo(at: number): string {
  return new Intl.DateTimeFormat(config.locale, { hour: '2-digit', minute: '2-digit' }).format(at);
}

/** Bottom-right transient stack. */
export function NotificationToasts() {
  const { toasts, dismissToast } = useNotifications();
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-[min(92vw,360px)] print:hidden">
      {toasts.map((n) => {
        const Ic = ICON[n.level];
        return (
          <div
            key={n.id}
            className={`flex items-start gap-3 rounded-lg bg-white border-l-4 ${BORDER[n.level]} px-4 py-3 animate-fade-in-up`}
            style={{ boxShadow: '0 8px 24px rgba(26,85,96,0.15)' }}
          >
            <Ic size={18} className={`shrink-0 mt-0.5 ${TINT[n.level]}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink-head">{n.title}</p>
              {n.message && <p className="text-xs text-ink-muted mt-0.5">{n.message}</p>}
            </div>
            <button onClick={() => dismissToast(n.id)} className="text-ink-muted hover:text-ink-head" aria-label="Fermer">
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Bell + dropdown notification center. */
export function NotificationCenter() {
  const { items, unread, markAllRead, remove, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);

  function toggle() {
    setOpen((o) => {
      if (!o) markAllRead();
      return !o;
    });
  }

  return (
    <div className="relative">
      <button
        onClick={toggle}
        aria-label="Notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink-muted hover:text-brand shadow-card"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 mt-2 z-50 w-[min(92vw,380px)] max-h-[70vh] flex flex-col rounded-lg bg-white border border-cream-subtle overflow-hidden"
            style={{ boxShadow: '0 8px 24px rgba(26,85,96,0.18)' }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-cream-subtle">
              <span className="text-sm font-semibold text-ink-head">Notifications</span>
              {items.length > 0 && (
                <button onClick={clearAll} className="flex items-center gap-1 text-xs text-ink-muted hover:text-danger">
                  <Trash2 size={13} /> Tout effacer
                </button>
              )}
            </div>
            <div className="overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-ink-muted">Aucune notification</p>
              ) : (
                items.map((n) => {
                  const Ic = ICON[n.level];
                  return (
                    <div key={n.id} className="group flex items-start gap-3 px-4 py-3 border-b border-cream-subtle/60 last:border-0 hover:bg-cream/40">
                      <Ic size={16} className={`shrink-0 mt-0.5 ${TINT[n.level]}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm font-medium text-ink-head truncate">{n.title}</p>
                          <span className="text-[11px] text-ink-muted shrink-0">{timeAgo(n.at)}</span>
                        </div>
                        {n.message && <p className="text-xs text-ink-muted mt-0.5">{n.message}</p>}
                      </div>
                      <button onClick={() => remove(n.id)} className="text-ink-muted opacity-0 group-hover:opacity-100 hover:text-danger" aria-label="Supprimer">
                        <X size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
