import { useEffect, useRef, useState } from 'react';
import { TrendingUp, Minus, Check, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Panel, PanelBody, PanelFooter, PanelHeader,
  Pill, Avatar, Glyph,
  Card, CardBody, CardRight,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import type { ProductFeedView, ProductOperatorView, ProductView } from './types';

// Flash feed entries that arrived since the previous update (SSE live push).
// Nothing flashes on first load. Effect-based (StrictMode-safe).
function useNewlyArrived(ids: number[]): Set<number> {
  const key = ids.join(',');
  const seen = useRef<Set<number> | null>(null);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(ids);
      return;
    }
    const arrived = ids.filter((id) => !seen.current!.has(id));
    if (arrived.length) {
      arrived.forEach((id) => seen.current!.add(id));
      setFresh(new Set(arrived));
      const t = setTimeout(() => setFresh(new Set()), 1100);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return fresh;
}

// ── KPI band ─────────────────────────────────────────────────────────────────

function KpiBand({ product }: { product: ProductView }) {
  return (
    <div className="h-[140px] bg-cream grid grid-cols-[1.1fr_1fr_1fr] py-5 px-1">
      <div className="px-6 flex flex-col justify-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-ink-muted leading-none">
          Taux NC du jour
        </span>
        <div>
          <p className="text-4xl font-bold text-ink-head tnum tracking-tightest leading-none">
            {product.ncRatePct}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-ink-muted mt-1.5">
            {product.ncRateDir === 'up' ? (
              <TrendingUp size={12} strokeWidth={1.5} className="text-danger flex-shrink-0" />
            ) : (
              <Minus size={12} strokeWidth={1.5} className="text-ink-muted flex-shrink-0" />
            )}
            {product.ncParts} pièce{product.ncParts > 1 ? 's' : ''} NC
          </p>
        </div>
      </div>

      <div className="px-6 flex flex-col justify-center gap-2 border-l border-cream-sub">
        <span className="text-xs font-medium uppercase tracking-wider text-ink-muted leading-none">
          Pièces inspectées
        </span>
        <div>
          <p className="text-4xl font-bold text-ink-head tnum tracking-tightest leading-none">
            {product.partsToday}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-success mt-1.5">
            <Check size={12} strokeWidth={2} className="flex-shrink-0" />
            {product.okParts} OK
          </p>
        </div>
      </div>

      <div className="px-6 flex flex-col justify-center gap-2 border-l border-cream-sub">
        <span className="text-xs font-medium uppercase tracking-wider text-ink-muted leading-none">
          Défauts relevés
        </span>
        <div>
          <p className="text-4xl font-bold text-ink-head tnum tracking-tightest leading-none">
            {product.defectCount}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-ink-muted mt-1.5">
            <Users size={12} strokeWidth={1.5} className="flex-shrink-0" />
            {product.activeOperators} opérateur{product.activeOperators > 1 ? 's' : ''} actif
            {product.activeOperators > 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Operators strip ──────────────────────────────────────────────────────────

function OperatorRow({ op }: { op: ProductOperatorView }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="relative flex-shrink-0">
        <Avatar initial={op.initial} />
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-cream',
            op.active ? 'bg-success' : 'bg-ink-muted/40',
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink-head leading-tight truncate">{op.name}</p>
        <p className="text-xs text-ink-muted mt-0.5">
          {op.active ? 'Actif' : `Vu ${op.lastAgo}`}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-base font-bold text-ink-head tnum leading-none">{op.parts}</p>
        <p className="text-xs text-ink-muted mt-1">{op.ncRatePct} NC</p>
      </div>
    </div>
  );
}

// ── Feed card ────────────────────────────────────────────────────────────────

function FeedCard({ entry, isNew }: { entry: ProductFeedView; isNew?: boolean }) {
  return (
    <Card
      variant={entry.isOther ? 'fallback' : 'default'}
      className={isNew ? 'animate-card-flash' : undefined}
    >
      <Glyph letter={entry.label[0]} seed={entry.label} variant={entry.isOther ? 'gold' : 'default'} />
      <CardBody>
        <p className="text-base font-semibold text-ink-head leading-snug">{entry.label}</p>
        <p className="text-xs text-ink-muted mt-0.5">
          {entry.category} · {entry.operatorName}
        </p>
        {entry.note && (
          <p className="text-sm text-ink-muted italic mt-1.5 leading-[1.45]">« {entry.note} »</p>
        )}
      </CardBody>
      <CardRight>
        <span className="text-xs uppercase tracking-wider text-ink-muted mono">{entry.ago}</span>
      </CardRight>
    </Card>
  );
}

// ── Product panel ────────────────────────────────────────────────────────────

export function ProductPanel({ product }: { product: ProductView }) {
  const freshIds = useNewlyArrived(product.feed.map((f) => f.id));
  const subline = [product.reference, product.client].filter(Boolean).join(' · ');

  return (
    <Panel minHeight>
      <PanelHeader
        left={
          <>
            <span className="text-xl font-bold text-ink-inv tracking-tightish">{product.name}</span>
            <span className="text-xs text-ink-inv/60 mono mt-0.5">{subline || `#${product.id}`}</span>
          </>
        }
        center={
          <Pill variant={product.active ? 'success' : 'idle'} tone="on-dark" dot>
            {product.active ? 'En production' : 'En pause'}
          </Pill>
        }
        right={
          <>
            <span className="text-sm font-medium text-ink-inv tnum">
              {product.partsToday} pièce{product.partsToday > 1 ? 's' : ''}
            </span>
            <span className="text-xs text-ink-inv/60 mono">{product.lastAgo}</span>
          </>
        }
      />

      <KpiBand product={product} />

      {product.operators.length > 0 && (
        <div className="px-6 py-3 bg-cream border-t border-cream-sub">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-1">
            Opérateurs sur ce produit
          </p>
          <div className="divide-y divide-cream-sub">
            {product.operators.map((op) => (
              <OperatorRow key={op.id ?? op.name} op={op} />
            ))}
          </div>
        </div>
      )}

      <PanelBody
        className="p-4 flex flex-col gap-3"
        style={{
          background:
            'linear-gradient(180deg, rgba(250,238,227,0.55) 0%, rgba(250,238,227,0.35) 100%)',
        }}
      >
        {product.feed.length === 0 ? (
          <p className="text-sm text-ink-muted text-center py-6">
            Aucun défaut relevé aujourd'hui — toutes les pièces conformes.
          </p>
        ) : (
          product.feed.map((entry) => (
            <FeedCard key={entry.id} entry={entry} isNew={freshIds.has(entry.id)} />
          ))
        )}
      </PanelBody>

      <PanelFooter>
        <span>
          {product.defectCount} défauts · {product.partsToday} pièces aujourd'hui
        </span>
        <Link
          to={`/logs?product=${product.id}`}
          className="text-accent font-medium hover:text-accent-light transition-colors"
        >
          Voir l'historique complet →
        </Link>
      </PanelFooter>
    </Panel>
  );
}
