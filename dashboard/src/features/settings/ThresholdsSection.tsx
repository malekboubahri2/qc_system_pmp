import { useState } from 'react';
import { toast } from 'sonner';
import { Section } from '@/components/ui';
import { Button } from '@/components/shared/Button';
import {
  getThresholds, setThresholds, DEFAULT_THRESHOLDS, PRODUCT_MIN_PARTS, type Thresholds,
} from '@/lib/thresholds';

function PctField({
  label, hint, value, onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm text-ink-head">{label}</p>
        {hint && <p className="text-xs text-ink-muted mt-0.5">{hint}</p>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <input
          type="number"
          min={0}
          max={100}
          step={0.5}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-20 text-right rounded-md border border-cream-sub bg-white px-2 py-1.5 text-sm text-ink tabular-nums focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
        />
        <span className="text-sm text-ink-muted">%</span>
      </div>
    </div>
  );
}

export function ThresholdsSection() {
  const [t, setT] = useState<Thresholds>(() => getThresholds());

  function save() {
    setThresholds(t);
    toast.success("Seuils d'alerte enregistrés");
  }

  return (
    <Section title="Seuils d'alerte">
      <p className="text-sm text-ink-muted mb-1">
        Déclenchent une notification sur le tableau de bord lorsqu'ils sont dépassés.
      </p>
      <div className="divide-y divide-cream/60">
        <PctField
          label="Taux NC global — avertissement"
          value={t.ncWarnPct}
          onChange={(v) => setT({ ...t, ncWarnPct: v })}
        />
        <PctField
          label="Taux NC global — critique"
          value={t.ncCritPct}
          onChange={(v) => setT({ ...t, ncCritPct: v })}
        />
        <PctField
          label="Taux NC d'un produit — critique"
          hint={`à partir de ${PRODUCT_MIN_PARTS} pièces inspectées`}
          value={t.productNcCritPct}
          onChange={(v) => setT({ ...t, productNcCritPct: v })}
        />
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="secondary" size="sm" onClick={() => setT(DEFAULT_THRESHOLDS)}>
          Réinitialiser
        </Button>
        <Button size="sm" onClick={save}>Enregistrer</Button>
      </div>
    </Section>
  );
}
