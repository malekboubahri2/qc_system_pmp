import { screen } from '@testing-library/react';
import { OperatorsPage } from '@/features/operators';
import { renderWithProviders } from '@/test-utils/render';

describe('OperatorsPage', () => {
  it('renders heading and at least one operator row', async () => {
    renderWithProviders(<OperatorsPage />);

    expect(await screen.findByRole('heading', { name: /Opérateurs/i })).toBeInTheDocument();
    // Fixture operator name — proves the table loaded
    expect(await screen.findByText('Mohammed')).toBeInTheDocument();
  });
});
