import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, ChevronRight, Archive, Layers, Filter } from 'lucide-react';
import { useProducts, useCreateProduct, useArchiveProduct } from '@/hooks/useProducts';
import { productSchema, type ProductForm } from '@/lib/schemas';
import { Button } from '@/components/shared/Button';
import { Modal } from '@/components/shared/Modal';
import { FormField } from '@/components/shared/FormField';
import { Icon } from '@/components/Icon';
import { PageHeader, Section, EmptyState } from '@/components/ui';

export function ProductsPage() {
  const { data: products = [], isLoading } = useProducts();
  const createProduct = useCreateProduct();
  const archiveProduct = useArchiveProduct();
  const [modalOpen, setModalOpen] = useState(false);
  const [clientFilter, setClientFilter] = useState('');

  // Distinct clients across products — powers the filter and the create-form
  // suggestions (a datalist of previously-used clients).
  const clients = [...new Set(products.map((p) => p.client).filter(Boolean))]
    .sort((a, b) => a!.localeCompare(b!)) as string[];
  const visible = clientFilter
    ? products.filter((p) => p.client === clientFilter)
    : products;

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<ProductForm>({ resolver: zodResolver(productSchema) });

  async function onSubmit(data: ProductForm) {
    await createProduct.mutateAsync({
      name: data.name,
      reference: data.reference || null,
      client: data.client || null,
      cheatsheet: data.cheatsheet || null,
    });
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
      <PageHeader
        breadcrumb={[{ label: 'Produits' }]}
        title="Produits"
        subtitle="Gérez les produits et leurs types de défauts"
        right={
          <Button onClick={() => setModalOpen(true)}>
            <Icon icon={Plus} size={16} />
            Nouveau produit
          </Button>
        }
      />

      {isLoading && (
        <div className="flex items-center gap-3 text-ink-muted py-8 justify-center">
          <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          Chargement…
        </div>
      )}

      {!isLoading && products.length === 0 && (
        <Section>
          <EmptyState
            icon={Layers}
            title="Aucun produit"
            description="Créez votre premier produit pour configurer les types de défauts."
          />
          <div className="flex justify-center mt-4">
            <Button onClick={() => setModalOpen(true)}>
              <Icon icon={Plus} size={16} />
              Nouveau produit
            </Button>
          </div>
        </Section>
      )}

      {!isLoading && products.length > 0 && (
        <div className="flex flex-col gap-4">
          {clients.length > 0 && (
            <div className="flex items-center gap-2 self-start">
              <Icon icon={Filter} size={15} className="text-ink-muted" />
              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="bg-white border border-cream-subtle rounded-lg px-3 py-2 text-sm text-ink
                  focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              >
                <option value="">Tous les clients</option>
                {clients.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {clientFilter && (
                <span className="text-sm text-ink-muted">
                  {visible.length} produit{visible.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}

          {visible.length === 0 ? (
            <p className="text-sm text-ink-muted py-6 text-center">
              Aucun produit pour le client « {clientFilter} ».
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {visible.map((p) => (
                <div
                  key={p.id}
                  className="bg-white rounded-lg px-5 py-4 flex items-center gap-4"
                  style={{ boxShadow: '0 1px 3px rgba(26,85,96,0.08)' }}
                >
                  <Link
                    to={`/products/${p.id}`}
                    className="flex-1 flex items-center justify-between gap-3 hover:text-brand transition-colors"
                  >
                    <span className="flex flex-col">
                      <span className="text-base font-medium text-ink">{p.name}</span>
                      {(p.reference || p.client) && (
                        <span className="text-xs text-ink-muted mt-0.5">
                          {[p.reference, p.client].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </span>
                    <Icon icon={ChevronRight} size={16} className="text-ink-muted flex-shrink-0" />
                  </Link>
                  <button
                    onClick={() => handleArchive(p.id, p.name)}
                    className="p-1.5 rounded text-ink-muted hover:text-danger transition-colors"
                    title="Archiver"
                  >
                    <Icon icon={Archive} size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
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
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Référence" error={errors.reference?.message} placeholder="ex. PROD-001" {...register('reference')} />
            <FormField
              label="Client"
              error={errors.client?.message}
              placeholder="ex. Renault"
              list="product-clients"
              {...register('client')}
            />
            <datalist id="product-clients">
              {clients.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-ink-head">Fiche / consignes</label>
            <textarea
              {...register('cheatsheet')}
              rows={3}
              placeholder="Points de contrôle, consignes d'inspection…"
              className="bg-white border border-cream-subtle rounded-lg px-3 py-2.5 text-sm resize-none
                focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            />
          </div>
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
