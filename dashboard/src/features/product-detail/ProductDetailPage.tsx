import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Pencil, Archive } from 'lucide-react';
import {
  useProducts, useDefectTypes, useCategoryConstants,
  useCreateDefectType, useUpdateDefectType, useArchiveDefectType,
} from '@/hooks/useProducts';
import { Button } from '@/components/shared/Button';
import { Modal } from '@/components/shared/Modal';
import { FormField } from '@/components/shared/FormField';
import { Icon } from '@/components/Icon';
import { PageHeader } from '@/components/ui';
import type { DefectType } from '@/types';
import { DEFECT_TYPES_PER_CATEGORY_CAP } from './constants';

const typeSchema = z.object({
  label: z.string().min(1, 'Libellé requis').max(24, '24 caractères max'),
});
type TypeForm = z.infer<typeof typeSchema>;

function capBadgeClass(count: number): string {
  if (count >= DEFECT_TYPES_PER_CATEGORY_CAP) return 'bg-danger/10 text-danger';
  if (count >= 9) return 'bg-warning/10 text-warning';
  return 'bg-success/10 text-success';
}

function CategorySection({
  productId,
  categoryKind,
  displayName,
}: {
  productId: number;
  categoryKind: string;
  displayName: string;
}) {
  const { data: types = [] } = useDefectTypes(productId, categoryKind);
  const createType = useCreateDefectType();
  const updateType = useUpdateDefectType();
  const archiveType = useArchiveDefectType();

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DefectType | null>(null);

  const addForm = useForm<TypeForm>({ resolver: zodResolver(typeSchema) });
  const editForm = useForm<TypeForm>({ resolver: zodResolver(typeSchema) });

  const userTypes = types.filter((t) => !t.is_other_fallback);
  const userCount = userTypes.length;
  const atCap = userCount >= DEFECT_TYPES_PER_CATEGORY_CAP;

  async function handleAdd(data: TypeForm) {
    await createType.mutateAsync({
      productId,
      body: { category_kind: categoryKind, label: data.label },
    });
    toast.success('Type ajouté — configuration envoyée aux appareils');
    addForm.reset();
    setAddOpen(false);
  }

  async function handleEdit(data: TypeForm) {
    if (!editTarget) return;
    await updateType.mutateAsync({
      productId,
      typeId: editTarget.id,
      body: { label: data.label },
    });
    toast.success('Type modifié');
    setEditTarget(null);
  }

  async function handleArchive(t: DefectType) {
    if (!confirm(`Archiver "${t.label}" ?`)) return;
    await archiveType.mutateAsync({ productId, typeId: t.id });
    toast.success('Type archivé');
  }

  return (
    <div className="bg-white rounded-lg" style={{ boxShadow: '0 1px 3px rgba(26,85,96,0.08)' }}>
      <div className="flex items-center gap-3 px-5 py-4 border-b border-cream-subtle">
        <h3 className="text-base font-semibold text-ink-head flex-1">{displayName}</h3>
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${capBadgeClass(userCount)}`}>
          {userCount}/{DEFECT_TYPES_PER_CATEGORY_CAP} types
        </span>
      </div>

      <div className="divide-y divide-cream-subtle/60">
        {types.map((t) => (
          <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-cream/40 transition-colors">
            <span className="text-sm text-ink flex-1">
              {t.label}
              {t.is_other_fallback && (
                <span className="ml-2 text-xs text-ink-muted">(autre)</span>
              )}
            </span>
            {!t.is_other_fallback && (
              <>
                <button
                  onClick={() => { setEditTarget(t); editForm.setValue('label', t.label); }}
                  className="p-1.5 rounded text-ink-muted hover:text-brand transition-colors"
                  title="Modifier"
                >
                  <Icon icon={Pencil} size={14} />
                </button>
                <button
                  onClick={() => handleArchive(t)}
                  className="p-1.5 rounded text-ink-muted hover:text-danger transition-colors"
                  title="Archiver"
                >
                  <Icon icon={Archive} size={14} />
                </button>
              </>
            )}
          </div>
        ))}

        <div className="px-5 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAddOpen(true)}
            disabled={atCap}
            title={atCap ? 'Limite de 12 types atteinte' : undefined}
          >
            <Icon icon={Plus} size={15} />
            Ajouter un type
          </Button>
        </div>
      </div>

      {/* Add modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Nouveau type de défaut" size="sm">
        <form onSubmit={addForm.handleSubmit(handleAdd)} className="flex flex-col gap-4">
          <FormField
            label="Libellé"
            required
            maxLength={24}
            error={addForm.formState.errors.label?.message}
            hint="Max 24 caractères"
            placeholder="ex. Coulure"
            {...addForm.register('label')}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setAddOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" size="sm" loading={addForm.formState.isSubmitting}>Créer</Button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title="Modifier le type"
        size="sm"
      >
        <form onSubmit={editForm.handleSubmit(handleEdit)} className="flex flex-col gap-4">
          <FormField
            label="Libellé"
            required
            maxLength={24}
            error={editForm.formState.errors.label?.message}
            {...editForm.register('label')}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditTarget(null)}>
              Annuler
            </Button>
            <Button type="submit" size="sm" loading={editForm.formState.isSubmitting}>Enregistrer</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const id = Number(productId);

  const { data: products = [] } = useProducts();
  const { data: categories = [] } = useCategoryConstants();

  const product = products.find((p) => p.id === id);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        breadcrumb={[{ label: 'Produits', href: '/products' }, { label: product?.name ?? '…' }]}
        title={product?.name ?? '…'}
        subtitle="Types de défauts par catégorie"
      />

      {categories.map((cat) => (
        <CategorySection
          key={cat.kind}
          productId={id}
          categoryKind={cat.kind}
          displayName={cat.display_name}
        />
      ))}
    </div>
  );
}
