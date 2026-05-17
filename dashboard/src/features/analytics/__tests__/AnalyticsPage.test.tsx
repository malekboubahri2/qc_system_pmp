import { screen } from '@testing-library/react';
import { AnalyticsPage } from '@/features/analytics';
import { renderWithProviders } from '@/test-utils/render';

describe('AnalyticsPage', () => {
  it('renders heading and chart container with data (no empty-state shown)', async () => {
    renderWithProviders(<AnalyticsPage />);

    expect(await screen.findByRole('heading', { name: /Analytiques/i })).toBeInTheDocument();
    // data-testid on the daily trend ChartCard — proves the chart section mounted
    expect(await screen.findByTestId('analytics-chart')).toBeInTheDocument();
    // "Aucune donnée" must not appear — confirms fixture data was returned by MSW
    expect(screen.queryByText('Aucune donnée pour la période')).not.toBeInTheDocument();
  });
});
