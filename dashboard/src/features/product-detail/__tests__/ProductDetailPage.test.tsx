import { screen } from '@testing-library/react';
import { ProductDetailPage } from '@/features/product-detail';
import { renderWithProviders } from '@/test-utils/render';

describe('ProductDetailPage', () => {
  it('renders category sections from /constants/categories', async () => {
    renderWithProviders(<ProductDetailPage />, {
      initialPath: '/products/1',
      routePattern: '/products/:productId',
    });

    // Category display names from MSW fixture
    expect(await screen.findByText('PMP Défauts')).toBeInTheDocument();
    expect(await screen.findByText('Injection Défauts')).toBeInTheDocument();
  });

  it('renders defect type labels and cap counter', async () => {
    renderWithProviders(<ProductDetailPage />, {
      initialPath: '/products/1',
      routePattern: '/products/:productId',
    });

    // Both category sections render the same MSW fixture, so use findAllByText
    expect((await screen.findAllByText('Coulure')).length).toBeGreaterThan(0);
    // Fallback type is shown with "(autre)" annotation
    expect((await screen.findAllByText('(autre)')).length).toBeGreaterThan(0);
    // Cap counter: 1 user type (FIXTURE_TYPE) + fallback (not counted) = 1/12
    expect((await screen.findAllByText('1/12 types')).length).toBeGreaterThan(0);
  });
});
