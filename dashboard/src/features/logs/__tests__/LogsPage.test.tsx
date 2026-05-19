import { screen } from '@testing-library/react';
import { LogsPage } from '@/features/logs';
import { renderWithProviders } from '@/test-utils/render';

describe('LogsPage', () => {
  it('renders heading and at least one log row with product name', async () => {
    renderWithProviders(<LogsPage />);

    expect(await screen.findByRole('heading', { name: /Journaux/i })).toBeInTheDocument();
    // Fixture log has defect label 'Coulure'
    const matches = await screen.findAllByText('Coulure');
    expect(matches.length).toBeGreaterThan(0);
    // Product name appears in both the filter dropdown and the table cell
    expect((await screen.findAllByText('Capot moteur')).length).toBeGreaterThan(0);
  });
});
