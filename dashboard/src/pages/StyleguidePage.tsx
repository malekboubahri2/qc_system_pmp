/**
 * Development-only visual styleguide — route: /__styleguide
 * Renders one instance of every UI primitive for visual verification.
 * Not included in production builds (guarded by import.meta.env.DEV in App.tsx).
 */
import { Layers, AlertTriangle, Wifi } from 'lucide-react';
import {
  Panel, PanelBody, PanelFooter,
  PanelHeader,
  PageHeader,
  MetaPill,
  Card, CardBody, CardRight,
  Pill,
  StatBig,
  Avatar,
  Glyph,
  EmptyState,
  Section,
  Icon,
} from '@/components/ui';

export function StyleguidePage() {
  return (
    <div className="min-h-screen bg-cream p-8 font-sans">
      <h1 className="text-3xl font-bold text-ink-head mb-2">UI Primitives — Visual Styleguide</h1>
      <p className="text-sm text-ink-muted mb-10">Dev-only · Stations Frame 1 reference</p>

      {/* ── PageHeader ─────────────────────────────────── */}
      <div className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">PageHeader</h2>
        <PageHeader
          breadcrumb={[{ label: 'Qualité' }, { label: 'Stations en direct' }]}
          title="Stations en direct"
          subtitle="Activité en temps réel — deux postes d'inspection"
          right={
            <MetaPill>
              Mis à jour <span className="mono">à 14:32</span>
            </MetaPill>
          }
        />
      </div>

      {/* ── MetaPill ───────────────────────────────────── */}
      <div className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">MetaPill</h2>
        <MetaPill>Mis à jour <span className="mono">à 14:32</span></MetaPill>
      </div>

      {/* ── Pill variants ──────────────────────────────── */}
      <div className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">Pill — on-light</h2>
        <div className="flex flex-wrap gap-3">
          <Pill variant="success" dot>En ligne</Pill>
          <Pill variant="idle" dot>Inactif</Pill>
          <Pill variant="warning" dot>Dégradé</Pill>
          <Pill variant="danger" dot>Hors ligne</Pill>
          <Pill variant="info" dot>Info</Pill>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 bg-brand rounded-lg p-4">
          <Pill variant="success" tone="on-dark" dot>Session active</Pill>
          <Pill variant="idle" tone="on-dark" dot>En attente</Pill>
        </div>
      </div>

      {/* ── Avatar ─────────────────────────────────────── */}
      <div className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">Avatar</h2>
        <div className="flex gap-3">
          <Avatar initial="A" />
          <Avatar initial="MH" />
          <Avatar initial="Z" />
        </div>
      </div>

      {/* ── Glyph ──────────────────────────────────────── */}
      <div className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">Glyph</h2>
        <div className="flex gap-3 flex-wrap">
          {['Cratère', 'Bullage', 'Coulure', 'Retassure', 'Bavure', 'Pli'].map((label) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <Glyph letter={label[0]} seed={label} />
              <span className="text-xs text-ink-muted">{label}</span>
            </div>
          ))}
          <div className="flex flex-col items-center gap-1">
            <Glyph letter="A" seed="Autre" variant="gold" />
            <span className="text-xs text-ink-muted">gold</span>
          </div>
        </div>
      </div>

      {/* ── StatBig ────────────────────────────────────── */}
      <div className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">StatBig</h2>
        <div className="flex gap-10 flex-wrap">
          <StatBig label="Défauts aujourd'hui" value={12} trend={{ label: '3 dans la dernière heure', direction: 'up' }} />
          <StatBig label="Défauts (7 jours)" value={84} trend={{ label: 'Stable', direction: 'flat' }} />
          <StatBig label="Stations actives" value={2} />
        </div>
      </div>

      {/* ── Card ───────────────────────────────────────── */}
      <div className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">Card variants</h2>
        <div className="flex flex-col gap-3 max-w-lg">
          <Card>
            <Glyph letter="C" seed="Cratère" />
            <CardBody>
              <p className="text-base font-semibold text-ink-head">Cratère</p>
              <p className="text-xs text-ink-muted mt-0.5">PMP Défauts</p>
            </CardBody>
            <CardRight>
              <span className="text-xs uppercase tracking-wider text-ink-muted mono">il y a 12s</span>
              <span className="bg-cream-sub text-ink-muted rounded px-2 py-0.5 text-xs mono">PROD-001</span>
            </CardRight>
          </Card>

          <Card variant="fallback">
            <Glyph letter="A" seed="Autre" variant="gold" />
            <CardBody>
              <p className="text-base font-semibold text-ink-head">Autre — préciser</p>
              <p className="text-xs text-ink-muted mt-0.5">Saisie libre</p>
              <p className="text-sm text-ink-muted italic mt-1.5">« Marque inhabituelle près du rebord »</p>
            </CardBody>
            <CardRight>
              <span className="text-xs uppercase tracking-wider text-ink-muted mono">il y a 7 min</span>
            </CardRight>
          </Card>

          <Card variant="historical">
            <Glyph letter="B" seed="Bullage" />
            <CardBody>
              <p className="text-base font-semibold text-ink-head">Bullage</p>
              <p className="text-xs text-ink-muted mt-0.5">PMP Défauts</p>
            </CardBody>
            <CardRight>
              <span className="text-xs uppercase tracking-wider text-ink-muted mono">hier 14:30</span>
            </CardRight>
          </Card>
        </div>
      </div>

      {/* ── Section ────────────────────────────────────── */}
      <div className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">Section</h2>
        <Section title="Activité récente" action={<Pill variant="info">10 entrées</Pill>}>
          <p className="text-sm text-ink-muted">Contenu de la section ici.</p>
        </Section>
      </div>

      {/* ── EmptyState ─────────────────────────────────── */}
      <div className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">EmptyState</h2>
        <Section>
          <EmptyState
            icon={Layers}
            title="Aucune activité"
            description="Aucun défaut enregistré sur les 7 derniers jours."
          />
        </Section>
      </div>

      {/* ── Panel ──────────────────────────────────────── */}
      <div className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">Panel + PanelHeader</h2>
        <div className="max-w-sm">
          <Panel>
            <PanelHeader
              left={
                <>
                  <span className="text-xl font-bold text-ink-inv tracking-tightish">Station 1</span>
                  <span className="text-xs text-ink-inv/60 mono mt-0.5">qc-stm32-pilot01</span>
                </>
              }
              center={<Pill variant="success" tone="on-dark" dot>Session active</Pill>}
              right={
                <>
                  <span className="flex items-center gap-2 text-sm font-medium text-ink-inv">
                    <span className="w-2 h-2 rounded-full bg-[#6BD4A4]" style={{ boxShadow: '0 0 0 3px rgba(107,212,164,0.20)' }} />
                    En ligne
                  </span>
                  <span className="text-xs text-ink-inv/60 mono">il y a 4s</span>
                </>
              }
            />
            <PanelBody className="p-4">
              <p className="text-sm text-ink-muted">Corps du panneau.</p>
            </PanelBody>
            <PanelFooter>
              <span>6 défauts visibles</span>
              <a href="#" className="text-accent font-medium hover:text-accent-light">Voir l'historique →</a>
            </PanelFooter>
          </Panel>
        </div>
      </div>

      {/* ── Icon ───────────────────────────────────────── */}
      <div className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">Icon (strokeWidth 1.5)</h2>
        <div className="flex gap-4 text-ink-head">
          <Icon icon={AlertTriangle} size={20} />
          <Icon icon={Wifi} size={20} />
          <Icon icon={Layers} size={20} />
        </div>
      </div>
    </div>
  );
}
