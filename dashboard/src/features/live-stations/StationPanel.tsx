import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Panel, PanelBody, PanelFooter, PanelHeader,
  Pill, Avatar, Glyph,
  Card, CardBody, CardRight,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import type { StationSession, FeedEntry, StationView } from './types';

// ── Session summary band ────────────────────────────────────────────────────

function SummaryBand({ session }: { session: StationSession }) {
  return (
    <div className="h-[140px] bg-cream grid grid-cols-[1.1fr_1.1fr_1fr] py-5 px-1">
      <div className="px-6 flex flex-col justify-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-ink-muted leading-none">
          Opérateur
        </span>
        <div className="flex items-center gap-3">
          <Avatar initial={session.operatorInitial} />
          <div>
            <p className="text-base font-semibold text-ink-head leading-tight">
              {session.operatorName}
            </p>
            <p className="text-xs text-ink-muted mt-0.5 leading-none">
              Connecté·e à <span className="mono">{session.connectedAt}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 flex flex-col justify-center gap-2 border-l border-cream-sub">
        <span className="text-xs font-medium uppercase tracking-wider text-ink-muted leading-none">
          Produit
        </span>
        <div>
          <p className="text-base font-semibold text-ink-head leading-tight">
            {session.productName}
          </p>
          <p className="text-sm text-ink-muted mt-1 mono">{session.productRef}</p>
        </div>
      </div>

      <div className="px-6 flex flex-col justify-center gap-2 border-l border-cream-sub">
        <span className="text-xs font-medium uppercase tracking-wider text-ink-muted leading-none">
          Défauts depuis le début
        </span>
        <div>
          <p className="text-4xl font-bold text-ink-head tnum tracking-tightest leading-none">
            {session.defectCount}
          </p>
          <TrendLine direction={session.trendDirection} label={session.trendLabel} />
        </div>
      </div>
    </div>
  );
}

function TrendLine({
  direction,
  label,
}: {
  direction: 'up' | 'flat' | 'down';
  label: string;
}) {
  const Icon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;
  return (
    <p className="flex items-center gap-1.5 text-xs text-ink-muted mt-1.5">
      <Icon size={12} strokeWidth={1.5} className="text-success flex-shrink-0" />
      {label}
    </p>
  );
}

// ── Feed card ───────────────────────────────────────────────────────────────

function FeedCard({ entry }: { entry: FeedEntry }) {
  return (
    <Card
      variant={entry.isOther ? 'fallback' : 'default'}
      repeatBadge={entry.repeatCount ? `↻ ${entry.repeatCount} répétés` : undefined}
    >
      <Glyph
        letter={entry.label[0]}
        seed={entry.label}
        variant={entry.isOther ? 'gold' : 'default'}
      />
      <CardBody>
        <p className="text-base font-semibold text-ink-head leading-snug">{entry.label}</p>
        <p className="text-xs text-ink-muted mt-0.5">{entry.category}</p>
        {entry.note && (
          <p className="text-sm text-ink-muted italic mt-1.5 leading-[1.45]">
            « {entry.note} »
          </p>
        )}
      </CardBody>
      <CardRight className={cn(entry.repeatCount && 'mt-4')}>
        <span className="text-xs uppercase tracking-wider text-ink-muted mono">{entry.ago}</span>
        <span className="bg-cream-sub text-ink-muted rounded px-2 py-0.5 text-xs mono">
          {entry.productRef}
        </span>
      </CardRight>
    </Card>
  );
}

// ── Station panel ───────────────────────────────────────────────────────────

export function StationPanel({ station }: { station: StationView }) {
  return (
    <Panel minHeight>
      <PanelHeader
        left={
          <>
            <span className="text-xl font-bold text-ink-inv tracking-tightish">
              {station.name}
            </span>
            <span className="text-xs text-ink-inv/60 mono mt-0.5">{station.deviceId}</span>
          </>
        }
        center={
          <Pill
            variant={station.sessionActive ? 'success' : 'idle'}
            tone="on-dark"
            dot
          >
            {station.sessionActive ? 'Session active' : 'En attente'}
          </Pill>
        }
        right={
          <>
            <span className="flex items-center gap-2 text-sm font-medium text-ink-inv">
              <span
                className={cn(
                  'w-2 h-2 rounded-full flex-shrink-0',
                  station.online ? 'bg-[#6BD4A4]' : 'bg-ink-inv/35',
                )}
                style={station.online ? { boxShadow: '0 0 0 3px rgba(107,212,164,0.20)' } : undefined}
              />
              {station.online ? 'En ligne' : 'Hors ligne'}
            </span>
            <span className="text-xs text-ink-inv/60 mono">{station.connSince}</span>
          </>
        }
      />

      <SummaryBand session={station.session} />

      <PanelBody
        className="p-4 flex flex-col gap-3"
        style={{
          background:
            'linear-gradient(180deg, rgba(250,238,227,0.55) 0%, rgba(250,238,227,0.35) 100%)',
        }}
      >
        {station.feed.map((entry) => (
          <FeedCard key={entry.id} entry={entry} />
        ))}
      </PanelBody>

      <PanelFooter>
        <span>
          {station.visibleCount} défauts visibles · {station.todayCount} aujourd'hui
        </span>
        <Link
          to={`/logs?device=${station.id}`}
          className="text-accent font-medium hover:text-accent-light transition-colors"
        >
          Voir l'historique complet →
        </Link>
      </PanelFooter>
    </Panel>
  );
}
