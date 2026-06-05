import { Package } from 'lucide-react';
import { PageHeader, MetaPill, EmptyState } from '@/components/ui';
import { useLiveProducts } from './useLiveProducts';
import { ProductPanel } from './ProductPanel';

export function LiveProductsPage() {
  const { products, updatedAt, isLoading, isError } = useLiveProducts();

  const count = products.length;
  const subtitle = isLoading
    ? 'Chargement…'
    : `Activité en temps réel — ${count} produit${count > 1 ? 's' : ''} en cours d'inspection`;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        breadcrumb={[{ label: 'Qualité' }, { label: 'Produits en direct' }]}
        title="Produits en direct"
        subtitle={subtitle}
        right={
          <MetaPill>
            Mis à jour <span className="mono">à {updatedAt}</span>
          </MetaPill>
        }
      />

      {!isLoading && count === 0 ? (
        <EmptyState
          icon={Package}
          title={isError ? 'Données indisponibles' : 'Aucun produit en cours'}
          description={
            isError
              ? 'Impossible de joindre le serveur. Nouvelle tentative en cours…'
              : "Aucune inspection aujourd'hui. Les produits apparaissent ici dès la première pièce inspectée."
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {products.map((product) => (
            <ProductPanel key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
