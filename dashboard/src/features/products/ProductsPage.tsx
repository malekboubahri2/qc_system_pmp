import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, ChevronRight, Archive } from 'lucide-react';
import { useProducts, useCreateProduct, useArchiveProduct } from '@/hooks/useProducts';
import { Button } from '@/components/shared/Button';
import { Modal } from '@/components/shared/Modal';
import { FormField } from '@/components/shared/FormField';
import { Icon } from '@/components/Icon';

const productSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(64, '64 caractères max'),
});
type ProductForm = z.infer<typeof productSchema>;

export function ProductsPage() {
  const { data: products = [], isLoading } = useProducts();
  const createProduct = useCreateProduct();
  const archiveProduct = useArchiveProduct();
  const [modalOpen, setModalOpen] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<ProductForm>({ resolver: zodResolver(productSchema) });

  async function onSubmit(data: ProductForm) {
    await createProduct.mutateAsync(data);
    toast.success('Produit créé — types de défauts initialisés');
    reset();
    setModalOpen(false);
  }

  async function handleArchive(id: number, name: string) {
    if (!confirm(`Archiver le produit "${name}" ?`)) return;
    await archiveProduct.mutateAsync(id);
    toast.success('Produit archivé');
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink-heading">Produits</h1>
          <p className="text-base text-ink-muted mt-1.5">
            Gérez les produits et leurs types de défauts
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Icon icon={Plus} size={16} />
          Nouveau produit
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-3 text-ink-muted py-8 justify-center">
          <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          Chargement…
        </div>
      )}

      {!isLoading && products.length === 0 && (
        <div className="bg-white rounded-lg p-12 text-center" style={{ boxShadow: '0 1px 3px rgba(26,85,96,0.08)' }}>
          <h3 className="text-lg font-semibold text-ink-heading mb-1">Aucun produit</h3>
          <p className="text-sm text-ink-muted mb-4">
            Créez votre premier produit pour configurer les types de défauts.
          </p>
          <Button onClick={() => setModalOpen(true)}>
            <Icon icon={Plus} size={16} />
            Nouveau produit
          </Button>
        </div>
      )}

      {!isLoading && products.length > 0 && (
        <div className="flex flex-col gap-3">
          {products.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-lg px-5 py-4 flex items-center gap-4"
              style={{ boxShadow: '0 1px 3px rgba(26,85,96,0.08)' }}
            >
              <Link
                to={`/products/${p.id}`}
                className="flex-1 flex items-center gap-3 hover:text-brand transition-colors"
              >
                <span className="text-base font-medium text-ink">{p.name}</span>
                <Icon icon={ChevronRight} size={16} className="text-ink-muted" />
              </Link>
              <button
                onClick={() => handleArchive(p.id, p.name)}
                className="text-ink-muted hover:text-danger transition-colors"
                title="Archiver"
              >
                <Icon icon={Archive} size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouveau produit" size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <FormField
            label="Nom du produit"
            required
            error={errors.name?.message}
            placeholder="ex. Capot moteur"
            {...register('name')}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" size="sm" loading={isSubmitting}>Créer</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
