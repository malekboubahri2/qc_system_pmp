import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Pencil, Archive, ChevronDown, ChevronRight } from 'lucide-react';
import {
  useCategories, useCreateCategory, useUpdateCategory, useArchiveCategory,
  useTypes, useCreateType, useUpdateType, useArchiveType,
} from '@/hooks/useDefects';
import { categorySchema, typeSchema, type CategoryForm, type TypeForm } from '@/lib/schemas';
import { Button } from '@/components/shared/Button';
import { Modal } from '@/components/shared/Modal';
import { FormField, SelectField } from '@/components/shared/FormField';
import { Icon } from '@/components/Icon';
import type { DefectCategory, DefectType } from '@/types';

const CAP = 12;

function capBadgeClass(count: number): string {
  if (count >= CAP) return 'bg-danger/10 text-danger';
  if (count >= 9) return 'bg-warning/10 text-warning';
  return 'bg-success/10 text-success';
}

// ── Category form modal ──────────────────────────────────────────
function CategoryModal({
  open,
  onClose,
  initial,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial?: DefectCategory;
  onSave: (name: string) => Promise<void>;
}) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<CategoryForm>({ resolver: zodResolver(categorySchema), values: initial ? { name: initial.name } : undefined });

  async function submit(data: CategoryForm) {
    await onSave(data.name);
    reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Modifier la catégorie' : 'Nouvelle catégorie'} size="sm">
      <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
        <FormField label="Nom" required error={errors.name?.message} placeholder="ex. Peinture" {...register('name')} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Annuler</Button>
          <Button type="submit" size="sm" loading={isSubmitting}>{initial ? 'Enregistrer' : 'Créer'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Type form modal ──────────────────────────────────────────────
function TypeModal({
  open,
  onClose,
  categories,
  initial,
  defaultCategoryId,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  categories: DefectCategory[];
  initial?: DefectType;
  defaultCategoryId?: number;
  onSave: (data: TypeForm) => Promise<void>;
}) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<TypeForm>({
      resolver: zodResolver(typeSchema),
      values: initial
        ? { label: initial.label, category_id: initial.category_id }
        : { label: '', category_id: defaultCategoryId ?? categories[0]?.id ?? 0 },
    });

  async function submit(data: TypeForm) {
    await onSave(data);
    reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Modifier le type' : 'Nouveau type de défaut'} size="sm">
      <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
        {!initial && (
          <SelectField label="Catégorie" required error={errors.category_id?.message} {...register('category_id', { valueAsNumber: true })}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectField>
        )}
        <FormField
          label="Libellé"
          required
          maxLength={24}
          error={errors.label?.message}
          hint="Max 24 caractères"
          placeholder="ex. Coulure"
          {...register('label')}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Annuler</Button>
          <Button type="submit" size="sm" loading={isSubmitting}>{initial ? 'Enregistrer' : 'Créer'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Category section ─────────────────────────────────────────────
function CategorySection({
  category,
  types,
  onEditCategory,
  onArchiveCategory,
  onAddType,
  onEditType,
  onArchiveType,
}: {
  category: DefectCategory;
  types: DefectType[];
  onEditCategory: () => void;
  onArchiveCategory: () => void;
  onAddType: () => void;
  onEditType: (t: DefectType) => void;
  onArchiveType: (t: DefectType) => void;
}) {
  const [open, setOpen] = useState(true);
  const count = types.length;
  const atCap = count >= CAP;

  return (
    <div className="bg-white rounded-lg" style={{ boxShadow: '0 1px 3px rgba(26,85,96,0.08)' }}>
      {/* Category header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-cream-subtle">
        <button onClick={() => setOpen((v) => !v)} className="text-ink-muted hover:text-ink transition-colors">
          <Icon icon={open ? ChevronDown : ChevronRight} size={18} />
        </button>
        <h3 className="text-base font-semibold text-ink-heading flex-1">{category.name}</h3>

        {/* Cap counter */}
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${capBadgeClass(count)}`}>
          {count}/{CAP} types
        </span>

        {/* Actions */}
        <button onClick={onEditCategory} className="text-ink-muted hover:text-brand transition-colors" title="Modifier">
          <Icon icon={Pencil} size={15} />
        </button>
        <button onClick={onArchiveCategory} className="text-ink-muted hover:text-danger transition-colors" title="Archiver">
          <Icon icon={Archive} size={15} />
        </button>
      </div>

      {/* Types list */}
      {open && (
        <div className="divide-y divide-cream-subtle/60">
          {types.length === 0 && (
            <p className="px-5 py-4 text-sm text-ink-muted">Aucun type dans cette catégorie.</p>
          )}
          {types.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-cream/40 transition-colors">
              <span className="text-sm text-ink flex-1">{t.label}</span>
              <button onClick={() => onEditType(t)} className="text-ink-muted hover:text-brand transition-colors" title="Modifier">
                <Icon icon={Pencil} size={14} />
              </button>
              <button onClick={() => onArchiveType(t)} className="text-ink-muted hover:text-danger transition-colors" title="Archiver">
                <Icon icon={Archive} size={14} />
              </button>
            </div>
          ))}

          {/* Add type row */}
          <div className="px-5 py-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onAddType}
              disabled={atCap}
              title={atCap ? 'Limite de 12 types atteinte' : undefined}
            >
              <Icon icon={Plus} size={15} />
              Ajouter un type
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────
export function DefectsPage() {
  const { data: categories = [], isLoading: catLoading } = useCategories();
  const { data: allTypes = [], isLoading: typeLoading } = useTypes();

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const archiveCategory = useArchiveCategory();
  const createType = useCreateType();
  const updateType = useUpdateType();
  const archiveType = useArchiveType();

  const [catModal, setCatModal] = useState<{ open: boolean; editing?: DefectCategory }>({ open: false });
  const [typeModal, setTypeModal] = useState<{ open: boolean; editing?: DefectType; catId?: number }>({ open: false });

  const typesByCategory = Object.fromEntries(
    categories.map((c) => [c.id, allTypes.filter((t) => t.category_id === c.id)])
  );

  async function handleSaveCategory(name: string) {
    if (catModal.editing) {
      await updateCategory.mutateAsync({ id: catModal.editing.id, body: { name } });
      toast.success('Catégorie modifiée');
    } else {
      await createCategory.mutateAsync({ name });
      toast.success('Catégorie créée');
    }
  }

  async function handleArchiveCategory(c: DefectCategory) {
    if (!confirm(`Archiver la catégorie "${c.name}" ?`)) return;
    await archiveCategory.mutateAsync(c.id);
    toast.success('Catégorie archivée');
  }

  async function handleSaveType(data: TypeForm) {
    if (typeModal.editing) {
      await updateType.mutateAsync({ id: typeModal.editing.id, body: { label: data.label } });
      toast.success('Type modifié');
    } else {
      await createType.mutateAsync(data);
      toast.success('Type créé — configuration envoyée aux appareils');
    }
  }

  async function handleArchiveType(t: DefectType) {
    if (!confirm(`Archiver le type "${t.label}" ?`)) return;
    await archiveType.mutateAsync(t.id);
    toast.success('Type archivé');
  }

  const isLoading = catLoading || typeLoading;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink-heading">Défauts</h1>
          <p className="text-sm text-ink-muted mt-1">Catégories et types affichés sur le terminal opérateur</p>
        </div>
        <Button onClick={() => setCatModal({ open: true })}>
          <Icon icon={Plus} size={16} />
          Nouvelle catégorie
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-3 text-ink-muted py-8 justify-center">
          <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          Chargement…
        </div>
      )}

      {/* Empty state */}
      {!isLoading && categories.length === 0 && (
        <div className="bg-white rounded-lg p-12 text-center" style={{ boxShadow: '0 1px 3px rgba(26,85,96,0.08)' }}>
          <div className="text-4xl mb-3">🗂️</div>
          <h3 className="text-lg font-semibold text-ink-heading mb-1">Aucune catégorie</h3>
          <p className="text-sm text-ink-muted mb-4">Créez votre première catégorie pour organiser les types de défauts.</p>
          <Button onClick={() => setCatModal({ open: true })}>
            <Icon icon={Plus} size={16} />
            Nouvelle catégorie
          </Button>
        </div>
      )}

      {/* Categories */}
      {!isLoading && (
        <div className="flex flex-col gap-4">
          {categories.map((cat) => (
            <CategorySection
              key={cat.id}
              category={cat}
              types={typesByCategory[cat.id] ?? []}
              onEditCategory={() => setCatModal({ open: true, editing: cat })}
              onArchiveCategory={() => handleArchiveCategory(cat)}
              onAddType={() => setTypeModal({ open: true, catId: cat.id })}
              onEditType={(t) => setTypeModal({ open: true, editing: t, catId: t.category_id })}
              onArchiveType={handleArchiveType}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <CategoryModal
        open={catModal.open}
        onClose={() => setCatModal({ open: false })}
        initial={catModal.editing}
        onSave={handleSaveCategory}
      />
      <TypeModal
        open={typeModal.open}
        onClose={() => setTypeModal({ open: false })}
        categories={categories}
        initial={typeModal.editing}
        defaultCategoryId={typeModal.catId}
        onSave={handleSaveType}
      />
    </div>
  );
}
