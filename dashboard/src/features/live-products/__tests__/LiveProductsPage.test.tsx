import { screen } from '@testing-library/react';
import { LiveProductsPage } from '@/features/live-products';
import { renderWithProviders } from '@/test-utils/render';

describe('LiveProductsPage', () => {
  it('renders the page heading and the live product panel', async () => {
    renderWithProviders(<LiveProductsPage />);
    expect(await screen.findByRole('heading', { name: /Produits en direct/i })).toBeInTheDocument();
    expect(await screen.findByText('Capot moteur')).toBeInTheDocument();
    expect(await screen.findByText(/CM-100/)).toBeInTheDocument();
  });

  it('renders the operators working the product from /products/live', async () => {
    renderWithProviders(<LiveProductsPage />);
    expect(await screen.findByText('Mohammed')).toBeInTheDocument();
    expect(await screen.findByText('Sofia')).toBeInTheDocument();
  });

  it('renders the NC rate and the defect feed with operator names', async () => {
    renderWithProviders(<LiveProductsPage />);
    expect(await screen.findByText('23.5%')).toBeInTheDocument();   // product NC rate
    expect(await screen.findByText('Coulure')).toBeInTheDocument();
    expect(await screen.findByText(/PMP Défauts · Mohammed/)).toBeInTheDocument();
  });
});
