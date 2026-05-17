import { screen } from '@testing-library/react';
import { LogsPage } from '@/features/logs';
import { renderWithProviders } from '@/test-utils/render';

describe('LogsPage', () => {
  it('renders heading and at least one log row', async () => {
    renderWithProviders(<LogsPage />);

    expect(await screen.findByRole('heading', { name: /Journaux/i })).toBeInTheDocument();
    // Fixture log has defect_label 'Coulure' — 'Coulure' may appear in multiple
    // places (table row + filter dropdown), so assert at least one occurrence.
    const matches = await screen.findAllByText('Coulure');
    expect(matches.length).toBeGreaterThan(0);
  });
});
