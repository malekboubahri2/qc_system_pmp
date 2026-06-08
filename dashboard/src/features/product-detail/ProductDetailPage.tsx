import { useRef, useState, type ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Pencil, Archive, FileText, Upload, Eye, Trash2 } from 'lucide-react';
import {
  useProducts, useUpdateProduct, useDefectTypes, useCategoryConstants,
  useCreateDefectType, useUpdateDefectType, useArchiveDefectType,
  useUploadCheatsheet, useDeleteCheatsheet,
} from '@/hooks/useProducts';
import { productSchema, type ProductForm } from '@/lib/schemas';
import { Button } from '@/components/shared/Button';
import { Modal } from '@/components/shared/Modal';
import { FormField } from '@/components/shared/FormField';
import { CheatsheetViewer } from '@/components/shared/CheatsheetViewer';
import { Icon } from '@/components/Icon';
import { PageHeader } from '@/components/ui';
import type { DefectType, Product } from '@/types';
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

function cheatsheetErrorMessage(err: unknown): string {
  const ax = err as { response?: { data?: { detail?: string } } };
  return ax?.response?.data?.detail ?? 'Échec du téléversement';
}

// Uploaded cheatsheet document (PDF/image) — distinct from the free-text notes.
function CheatsheetDocCard({ product }: { product: Product }) {
  const upload = useUploadCheatsheet();
  const remove = useDeleteCheatsheet();
  const inputRef = useRef<HTMLInputElement>(null);
  const [viewing, setViewing] = useState(false);

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await upload.mutateAsync({ id: product.id, file });
      toast.success('Fiche défauts téléversée');
    } catch (err) {
      toast.error(cheatsheetErrorMessage(err));
    }
  }

  async function onRemove() {
    if (!confirm('Supprimer la fiche défauts ?')) return;
    await remove.mutateAsync(product.id);
    toast.success('Fiche supprimée');
  }

  return (
    <div className="bg-white rounded-lg p-5 flex items-center gap-4" style={{ boxShadow: '0 1px 3px rgba(26,85,96,0.08)' }}>
      <div className="shrink-0 w-10 h-10 rounded-lg bg-cream flex items-center justify-center text-brand">
        <Icon icon={FileText} size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-semibold text-ink-head">Fiche défauts (document)</h3>
        <p className="text-sm text-ink-muted truncate">
          {product.has_cheatsheet_file
            ? product.cheatsheet_name ?? 'Document attaché'
            : 'Aucun document — PDF ou image que les inspecteurs consultent'}
        </p>
      </div>
      {product.has_cheatsheet_file && (
        <Button variant="ghost" size="sm" onClick={() => setViewing(true)}>
          <Icon icon={Eye} size={15} /> Voir
        </Button>
      )}
      <Button variant="secondary" size="sm" loading={upload.isPending} onClick={() => inputRef.current?.click()}>
        <Icon icon={Upload} size={15} /> {product.has_cheatsheet_file ? 'Remplacer' : 'Téléverser'}
      </Button>
      {product.has_cheatsheet_file && (
        <button onClick={onRemove} title="Supprimer" className="p-2 rounded text-ink-muted hover:text-danger transition-colors">
          <Icon icon={Trash2} size={15} />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={onPick}
      />
      {viewing && (
        <CheatsheetViewer productId={product.id} productName={product.name} onClose={() => setViewing(false)} />
      )}
    </div>
  );
}

export function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const id = Number(productId);

  const { data: products = [] } = useProducts();
  const { data: categories = [] } = useCategoryConstants();
  const [editOpen, setEditOpen] = useState(false);

  const product = products.find((p) => p.id === id);
  const hasInfo = product && (product.reference || product.client || product.cheatsheet);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        breadcrumb={[{ label: 'Produits', href: '/products' }, { label: product?.name ?? '…' }]}
        title={product?.name ?? '…'}
        subtitle="Fiche produit & types de défauts"
        right={product && (
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            <Icon icon={Pencil} size={15} /> Modifier la fiche
          </Button>
        )}
      />

      {hasInfo && (
        <div className="bg-white rounded-lg p-5 flex flex-col gap-3" style={{ boxShadow: '0 1px 3px rgba(26,85,96,0.08)' }}>
          <div className="flex flex-wrap gap-x-10 gap-y-2 text-sm">
            {product!.reference && (
              <div><span className="text-ink-muted">Référence : </span><span className="font-mono text-ink">{product!.reference}</span></div>
            )}
            {product!.client && (
              <div><span className="text-ink-muted">Client : </span><span className="font-medium text-ink">{product!.client}</span></div>
            )}
          </div>
          {product!.cheatsheet && (
            <div className="text-sm text-ink-muted whitespace-pre-wrap border-t border-cream-subtle pt-3">{product!.cheatsheet}</div>
          )}
        </div>
      )}

      {product && <CheatsheetDocCard product={product} />}

      {product && (
        <ProductEditModal open={editOpen} onClose={() => setEditOpen(false)} product={product} />
      )}

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

// ── Product fiche edit modal ──────────────────────────────────────
function ProductEditModal({
  open, onClose, product,
}: {
  open: boolean;
  onClose: () => void;
  product: Product;
}) {
  const updateProduct = useUpdateProduct();
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<ProductForm>({
      resolver: zodResolver(productSchema),
      values: {
        name: product.name,
        reference: product.reference ?? '',
        client: product.client ?? '',
        cheatsheet: product.cheatsheet ?? '',
      },
    });

  async function submit(data: ProductForm) {
    await updateProduct.mutateAsync({
      id: product.id,
      body: {
        name: data.name,
        reference: data.reference || null,
        client: data.client || null,
        cheatsheet: data.cheatsheet || null,
      },
    });
    toast.success('Fiche produit mise à jour');
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Modifier la fiche produit" size="sm">
      <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
        <FormField label="Nom" required error={errors.name?.message} {...register('name')} />
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Référence" error={errors.reference?.message} placeholder="ex. PROD-001" {...register('reference')} />
          <FormField label="Client" error={errors.client?.message} placeholder="ex. Renault" {...register('client')} />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-ink-head">Fiche / consignes</label>
          <textarea
            {...register('cheatsheet')}
            rows={4}
            placeholder="Points de contrôle, consignes d'inspection…"
            className="bg-white border border-cream-subtle rounded-lg px-3 py-2.5 text-sm resize-none
              focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Annuler</Button>
          <Button type="submit" size="sm" loading={isSubmitting}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}
