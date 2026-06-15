import { useEffect, useState, type ReactNode } from 'react';
import { config } from '@/config';
import { DEFAULT_THRESHOLDS as T } from '@/lib/thresholds';

// Public andon wall display. Reads the unauthenticated board snapshot and
// renders big, glanceable KPIs for the room. No login, no router — one screen
// that polls and repaints.

interface BoardProduct {
  name: string;
  parts: number;
  nc_rate: number;
}
interface BoardDefect {
  label: string;
  count: number;
  ratio: number;
}
interface Board {
  updated_at: string;
  date: string;
  nc_rate: number;
  inspected_parts: number;
  nc_parts: number;
  ok_parts: number;
  products: BoardProduct[];
  defects: BoardDefect[];
}

// SSE drives real-time updates; this poll is just a safety net (reconnect gaps,
// the daily date rollover when the line is idle).
const POLL_MS = 30_000;

type Tone = 'success' | 'warning' | 'danger';

/** Map a Taux NC percentage to a severity tone using the default thresholds. */
function toneForPct(pct: number): Tone {
  if (pct >= T.ncCritPct) return 'danger';
  if (pct >= T.ncWarnPct) return 'warning';
  return 'success';
}

const TONE_TEXT: Record<Tone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};
const TONE_BAR: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

function useBoard(): { data: Board | null; stale: boolean } {
  const [data, setData] = useState<Board | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let alive = true;
    const url = `${config.apiBaseUrl}/kpi/board/public`;
    async function tick() {
      try {
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as Board;
        if (alive) {
          setData(json);
          setStale(false);
        }
      } catch {
        if (alive) setStale(true); // keep showing the last good values
      }
    }
    tick();
    const id = setInterval(tick, POLL_MS);
    // Real-time: refetch the instant an inspection lands. The /events stream is
    // a content-free, unauthenticated nudge (EventSource auto-reconnects).
    const es = new EventSource(`${config.apiBaseUrl}/events`);
    es.addEventListener('inspection', () => {
      void tick();
    });
    return () => {
      alive = false;
      clearInterval(id);
      es.close();
    };
  }, []);

  return { data, stale };
}

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(config.locale, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div
        className="font-bold text-ink-inverse tnum leading-none"
        style={{ fontSize: 'clamp(2.6rem, 9.5vw, 6.5rem)' }}
      >
        {value}
      </div>
      <div className="text-fluid-base font-medium text-ink-inverse/70 mt-2 uppercase tracking-wide">
        {label}
      </div>
      {hint && <div className="text-fluid-base text-ink-inverse/50 mt-0.5">{hint}</div>}
    </div>
  );
}

function Bar({ fraction, tone }: { fraction: number; tone: Tone }) {
  const w = Math.max(2, Math.min(100, fraction * 100));
  return (
    <div className="h-[1.1vmin] min-h-2.5 rounded-full bg-cream-subtle overflow-hidden">
      <div
        className={`h-full rounded-full ${TONE_BAR[tone]} transition-[width] duration-500`}
        style={{ width: `${w}%` }}
      />
    </div>
  );
}

export function AndonApp() {
  const { data, stale } = useBoard();

  const ncPct = data ? data.nc_rate * 100 : 0;
  const tone = toneForPct(ncPct);
  const hasParts = !!data && data.inspected_parts > 0;

  return (
    <div className="h-dvh w-full bg-cream flex flex-col overflow-hidden p-[2vmin] gap-[2vmin]">
      {/* Header */}
      <header className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="PMP" className="h-[7vmin] max-h-16 w-auto" />
          <div className="min-w-0">
            <h1 className="text-fluid-lg font-bold text-ink-heading leading-tight">
              Tableau Andon — Contrôle Qualité
            </h1>
            <p className="text-fluid-sm text-ink-muted truncate">{config.plantName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span
            className={`w-3 h-3 rounded-full ${stale ? 'bg-danger' : 'bg-success animate-livepulse'}`}
            title={stale ? 'Reconnexion…' : 'En direct'}
          />
          <div className="text-right">
            <div className="text-fluid-sm text-ink-muted leading-none">
              {stale ? 'Reconnexion…' : 'Mis à jour'}
            </div>
            <div className="text-fluid-base font-semibold text-ink tnum leading-tight">
              {data ? formatTime(data.updated_at) : '—'}
            </div>
          </div>
        </div>
      </header>

      {/* Hero band — global Taux NC + headline counts */}
      <section className="shrink-0 rounded-2xl bg-brand shadow-elevated px-[3vmin] py-[3vmin] animate-fade-in-up">
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_1fr_1fr] gap-[3vmin] items-center">
          <div className="text-center lg:text-left">
            <div className="text-fluid-lg font-semibold uppercase tracking-wide text-ink-inverse/70">
              Taux NC global
            </div>
            <div
              className={`font-bold tnum leading-[0.9] ${TONE_TEXT[tone]}`}
              style={{ fontSize: 'clamp(5rem, 23vw, 16rem)' }}
            >
              {hasParts ? pct(data!.nc_rate) : '—'}
            </div>
            <div className="text-fluid-base text-ink-inverse/60 mt-1">
              {data ? `${data.date}` : ''}
            </div>
          </div>
          <Stat label="Pièces inspectées" value={data ? String(data.inspected_parts) : '—'} />
          <Stat label="Pièces NC" value={data ? String(data.nc_parts) : '—'} />
          <Stat label="Pièces OK" value={data ? String(data.ok_parts) : '—'} />
        </div>
      </section>

      {/* Two columns: products + trending defects */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-[2vmin]">
        <Panel title="Produits — Taux NC">
          {data && data.products.length > 0 ? (
            <ul className="flex flex-col gap-[1.6vmin]">
              {data.products.map((p) => {
                const t = toneForPct(p.nc_rate * 100);
                return (
                  <li key={p.name} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-fluid-lg font-semibold text-ink truncate">{p.name}</span>
                      <span className="text-fluid-base text-ink-muted tnum shrink-0">
                        {p.parts} pcs · <span className={`font-bold ${TONE_TEXT[t]}`}>{pct(p.nc_rate)}</span>
                      </span>
                    </div>
                    <Bar fraction={p.nc_rate} tone={t} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty>Aucune pièce inspectée aujourd'hui</Empty>
          )}
        </Panel>

        <Panel title="Défauts fréquents">
          {data && data.defects.length > 0 ? (
            <ul className="flex flex-col gap-[1.6vmin]">
              {data.defects.map((d) => (
                <li key={d.label} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-fluid-lg font-semibold text-ink truncate">{d.label}</span>
                    <span className="text-fluid-base text-ink-muted tnum shrink-0">
                      {d.count} · {pct(d.ratio)}
                    </span>
                  </div>
                  <Bar fraction={d.ratio} tone="warning" />
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Aucun défaut enregistré aujourd'hui</Empty>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-h-0 flex flex-col rounded-2xl bg-white shadow-card p-[2.4vmin] animate-fade-in-up">
      <h2 className="text-fluid-lg font-semibold text-ink-heading mb-[1.6vmin] shrink-0">{title}</h2>
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="h-full flex items-center justify-center text-center">
      <p className="text-fluid-lg text-ink-muted">{children}</p>
    </div>
  );
}
