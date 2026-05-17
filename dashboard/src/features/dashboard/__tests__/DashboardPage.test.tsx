import { screen } from '@testing-library/react';
import { DashboardPage } from '@/features/dashboard';
import { renderWithProviders } from '@/test-utils/render';

describe('DashboardPage', () => {
  it('renders heading and at least one recent activity row', async () => {
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByRole('heading', { name: /Tableau de bord/i })).toBeInTheDocument();
    // Fixture log has defect_label 'Coulure' — proves the recent-activity feed loaded
    expect(await screen.findByText('Coulure')).toBeInTheDocument();
  });
});
