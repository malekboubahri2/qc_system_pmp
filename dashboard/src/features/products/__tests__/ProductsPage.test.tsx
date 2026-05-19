import { screen } from '@testing-library/react';
import { ProductsPage } from '@/features/products';
import { renderWithProviders } from '@/test-utils/render';

describe('ProductsPage', () => {
  it('renders heading and fixture product', async () => {
    renderWithProviders(<ProductsPage />);

    expect(await screen.findByRole('heading', { name: /Produits/i })).toBeInTheDocument();
    expect(await screen.findByText('Capot moteur')).toBeInTheDocument();
  });

  it('renders "Nouveau produit" button', async () => {
    renderWithProviders(<ProductsPage />);
    expect(await screen.findByRole('button', { name: /Nouveau produit/i })).toBeInTheDocument();
  });
});
