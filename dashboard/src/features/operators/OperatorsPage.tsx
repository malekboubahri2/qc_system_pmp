import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Pencil, Archive, RefreshCw, Users, Copy, Check, KeyRound } from 'lucide-react';
import {
  useOperators, useCreateOperator, useUpdateOperator,
  useRegeneratePin, useArchiveOperator,
} from '@/hooks/useOperators';
import { operatorSchema, type OperatorForm } from '@/lib/schemas';
import { Button } from '@/components/shared/Button';
import { Modal } from '@/components/shared/Modal';
import { FormField } from '@/components/shared/FormField';
import { Icon } from '@/components/Icon';
import { PageHeader, EmptyState, Pill } from '@/components/ui';
import type { Operator } from '@/types';

// ── Operator name modal (create / rename) ────────────────────────
function OperatorModal({
  open, onClose, initial, onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Operator;
  onSave: (name: string) => Promise<void>;
}) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<OperatorForm>({
      resolver: zodResolver(operatorSchema),
      values: initial ? { name: initial.name } : undefined,
    });

  async function submit(data: OperatorForm) {
    await onSave(data.name);
    reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Modifier l'opérateur" : 'Nouvel opérateur'} size="sm">
      <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
        <FormField label="Nom" required error={errors.name?.message} placeholder="ex. Ahmed Ben Ali" {...register('name')} />
        {!initial && (
          <p className="text-sm text-ink-muted">
            Un code PIN unique sera généré automatiquement et affiché une seule fois.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Annuler</Button>
          <Button type="submit" size="sm" loading={isSubmitting}>{initial ? 'Enregistrer' : 'Créer'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Reveal-once PIN modal ────────────────────────────────────────
function RevealPinModal({
  open, onClose, name, pin,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  pin: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(pin);
      setCopied(true);
    } catch {
      /* clipboard unavailable — the PIN is shown on screen anyway */
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`PIN — ${name}`} size="sm">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">
          Communiquez ce code à l&apos;opérateur. Il ne sera affiché qu&apos;une seule fois ;
          en cas de perte, régénérez-le.
        </p>
        <div className="flex items-center justify-center bg-cream-subtle rounded-lg py-6">
          <span className="text-4xl font-mono tracking-[0.35em] text-brand pl-[0.35em]">{pin}</span>
        </div>
        <div className="flex justify-between gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={copy}>
            <Icon icon={copied ? Check : Copy} size={15} />
            {copied ? 'Copié' : 'Copier'}
          </Button>
          <Button type="button" size="sm" onClick={onClose}>Terminé</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Main page ────────────────────────────────────────────────────
export function OperatorsPage() {
  const { data: operators = [], isLoading } = useOperators();
  const createOp = useCreateOperator();
  const updateOp = useUpdateOperator();
  const regenOp = useRegeneratePin();
  const archiveOp = useArchiveOperator();

  const [opModal, setOpModal] = useState<{ open: boolean; editing?: Operator }>({ open: false });
  const [reveal, setReveal] = useState<{ open: boolean; name: string; pin: string }>({ open: false, name: '', pin: '' });

  async function handleSaveOp(name: string) {
    if (opModal.editing) {
      await updateOp.mutateAsync({ id: opModal.editing.id, name });
      toast.success('Opérateur modifié');
    } else {
      const created = await createOp.mutateAsync(name);
      toast.success('Opérateur créé');
      setReveal({ open: true, name: created.name, pin: created.pin });
    }
  }

  async function handleRegen(op: Operator) {
    if (!confirm(`Régénérer le PIN de « ${op.name} » ? L'ancien code cessera de fonctionner.`)) return;
    const updated = await regenOp.mutateAsync(op.id);
    setReveal({ open: true, name: updated.name, pin: updated.pin });
    toast.success('Nouveau PIN généré');
  }

  async function handleArchive(op: Operator) {
    if (!confirm(`Archiver l'opérateur "${op.name}" ?`)) return;
    await archiveOp.mutateAsync(op.id);
    toast.success('Opérateur archivé');
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        breadcrumb={[{ label: 'Opérateurs' }]}
        title="Opérateurs"
        subtitle="Un PIN unique est généré à la création — affiché une seule fois"
        right={
          <Button onClick={() => setOpModal({ open: true })}>
            <Icon icon={Plus} size={16} />
            Nouvel opérateur
          </Button>
        }
      />

      {/* Table */}
      <div className="bg-white rounded-lg overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(26,85,96,0.08)' }}>
        {isLoading ? (
          <div className="flex items-center gap-3 justify-center py-12 text-ink-muted">
            <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            Chargement…
          </div>
        ) : operators.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Aucun opérateur"
            description="Créez votre premier opérateur pour commencer."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream-subtle text-xs font-semibold uppercase tracking-wider text-ink-muted">
                <th className="px-5 py-4 text-left">Nom</th>
                <th className="px-5 py-4 text-left">PIN</th>
                <th className="px-5 py-4 text-left">Statut</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {operators.map((op, i) => (
                <tr key={op.id} className={i % 2 === 0 ? 'bg-white' : 'bg-cream/30'}>
                  <td className="px-5 py-4 font-medium text-sm text-ink">{op.name}</td>
                  <td className="px-5 py-4">
                    <Pill variant={op.pin_set ? 'success' : 'warning'} dot>
                      {op.pin_set ? 'Défini' : 'Non défini'}
                    </Pill>
                  </td>
                  <td className="px-5 py-4">
                    <Pill variant={op.active ? 'success' : 'danger'} dot>
                      {op.active ? 'Actif' : 'Archivé'}
                    </Pill>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => handleRegen(op)}
                        className="p-1.5 rounded text-ink-muted hover:text-brand transition-colors"
                        title={op.pin_set ? 'Régénérer le PIN' : 'Générer un PIN'}>
                        <Icon icon={op.pin_set ? RefreshCw : KeyRound} size={15} />
                      </button>
                      <button onClick={() => setOpModal({ open: true, editing: op })}
                        className="p-1.5 rounded text-ink-muted hover:text-brand transition-colors" title="Modifier">
                        <Icon icon={Pencil} size={15} />
                      </button>
                      <button onClick={() => handleArchive(op)}
                        className="p-1.5 rounded text-ink-muted hover:text-danger transition-colors" title="Archiver">
                        <Icon icon={Archive} size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <OperatorModal open={opModal.open} onClose={() => setOpModal({ open: false })} initial={opModal.editing} onSave={handleSaveOp} />
      <RevealPinModal open={reveal.open} onClose={() => setReveal({ open: false, name: '', pin: '' })} name={reveal.name} pin={reveal.pin} />
    </div>
  );
}
