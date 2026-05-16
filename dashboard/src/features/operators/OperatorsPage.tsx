import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Pencil, Archive, KeyRound, Eye, EyeOff } from 'lucide-react';
import {
  useOperators, useCreateOperator, useUpdateOperator,
  useSetPin, useArchiveOperator,
} from '@/hooks/useOperators';
import { operatorSchema, pinSchema, type OperatorForm, type PinForm } from '@/lib/schemas';
import { Button } from '@/components/shared/Button';
import { Modal } from '@/components/shared/Modal';
import { FormField } from '@/components/shared/FormField';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Icon } from '@/components/Icon';
import type { Operator } from '@/types';

// ── Operator form modal ──────────────────────────────────────────
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
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Annuler</Button>
          <Button type="submit" size="sm" loading={isSubmitting}>{initial ? 'Enregistrer' : 'Créer'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── PIN modal ────────────────────────────────────────────────────
function PinModal({
  open, onClose, operator, onSave,
}: {
  open: boolean;
  onClose: () => void;
  operator: Operator | null;
  onSave: (pin: string) => Promise<void>;
}) {
  const [show, setShow] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<PinForm>({ resolver: zodResolver(pinSchema) });

  async function submit(data: PinForm) {
    await onSave(data.pin);
    reset();
    setShow(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={() => { onClose(); reset(); setShow(false); }}
      title={`PIN — ${operator?.name ?? ''}`} size="sm">
      <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">
          {operator?.pin_set ? 'Modifier le PIN de cet opérateur.' : 'Définir un PIN pour cet opérateur.'}
        </p>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-ink-heading">
            Nouveau PIN <span className="text-danger">*</span>
          </label>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              inputMode="numeric"
              maxLength={8}
              placeholder="4 à 8 chiffres"
              className={`w-full bg-white border rounded-lg px-3 py-2 pr-10 text-sm font-mono tracking-widest
                transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent
                ${errors.pin ? 'border-danger' : 'border-cream-subtle'}`}
              {...register('pin')}
            />
            <button type="button" onClick={() => setShow((v) => !v)}
              className="absolute inset-y-0 right-0 px-3 text-ink-muted hover:text-ink transition-colors" tabIndex={-1}>
              <Icon icon={show ? EyeOff : Eye} size={16} />
            </button>
          </div>
          {errors.pin && <p className="text-xs text-danger">{errors.pin.message}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => { onClose(); reset(); setShow(false); }}>Annuler</Button>
          <Button type="submit" size="sm" loading={isSubmitting}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Main page ────────────────────────────────────────────────────
export function OperatorsPage() {
  const { data: operators = [], isLoading } = useOperators();
  const createOp = useCreateOperator();
  const updateOp = useUpdateOperator();
  const setPin = useSetPin();
  const archiveOp = useArchiveOperator();

  const [opModal, setOpModal] = useState<{ open: boolean; editing?: Operator }>({ open: false });
  const [pinModal, setPinModal] = useState<{ open: boolean; operator: Operator | null }>({ open: false, operator: null });

  async function handleSaveOp(name: string) {
    if (opModal.editing) {
      await updateOp.mutateAsync({ id: opModal.editing.id, name });
      toast.success('Opérateur modifié');
    } else {
      await createOp.mutateAsync(name);
      toast.success('Opérateur créé — définissez son PIN pour l\'activer');
    }
  }

  async function handleSetPin(pin: string) {
    if (!pinModal.operator) return;
    await setPin.mutateAsync({ id: pinModal.operator.id, pin });
    toast.success('PIN enregistré — opérateur actif sur le terminal');
  }

  async function handleArchive(op: Operator) {
    if (!confirm(`Archiver l'opérateur "${op.name}" ?`)) return;
    await archiveOp.mutateAsync(op.id);
    toast.success('Opérateur archivé');
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink-heading">Opérateurs</h1>
          <p className="text-sm text-ink-muted mt-1">Chaque opérateur doit avoir un PIN pour utiliser le terminal</p>
        </div>
        <Button onClick={() => setOpModal({ open: true })}>
          <Icon icon={Plus} size={16} />
          Nouvel opérateur
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(26,85,96,0.08)' }}>
        {isLoading ? (
          <div className="flex items-center gap-3 justify-center py-12 text-ink-muted">
            <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            Chargement…
          </div>
        ) : operators.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-ink-muted">Aucun opérateur. Créez-en un pour commencer.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream-subtle text-xs font-medium uppercase tracking-wide text-ink-muted">
                <th className="px-5 py-3 text-left">Nom</th>
                <th className="px-5 py-3 text-left">PIN</th>
                <th className="px-5 py-3 text-left">Statut</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {operators.map((op, i) => (
                <tr key={op.id} className={i % 2 === 0 ? 'bg-white' : 'bg-cream/30'}>
                  <td className="px-5 py-3 font-medium text-ink">{op.name}</td>
                  <td className="px-5 py-3">
                    <StatusBadge
                      status={op.pin_set ? 'success' : 'warning'}
                      label={op.pin_set ? 'Défini' : 'Non défini'}
                    />
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={op.active ? 'success' : 'danger'} label={op.active ? 'Actif' : 'Archivé'} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => setPinModal({ open: true, operator: op })}
                        className="text-ink-muted hover:text-brand transition-colors" title="Définir PIN">
                        <Icon icon={KeyRound} size={15} />
                      </button>
                      <button onClick={() => setOpModal({ open: true, editing: op })}
                        className="text-ink-muted hover:text-brand transition-colors" title="Modifier">
                        <Icon icon={Pencil} size={15} />
                      </button>
                      <button onClick={() => handleArchive(op)}
                        className="text-ink-muted hover:text-danger transition-colors" title="Archiver">
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
      <PinModal open={pinModal.open} onClose={() => setPinModal({ open: false, operator: null })} operator={pinModal.operator} onSave={handleSetPin} />
    </div>
  );
}
