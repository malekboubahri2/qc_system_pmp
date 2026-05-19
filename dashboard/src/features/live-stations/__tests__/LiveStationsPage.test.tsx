import { screen } from '@testing-library/react';
import { LiveStationsPage } from '@/features/live-stations';
import { renderWithProviders } from '@/test-utils/render';

describe('LiveStationsPage', () => {
  it('renders page heading and both station panels', async () => {
    renderWithProviders(<LiveStationsPage />);
    expect(await screen.findByRole('heading', { name: /Stations en direct/i })).toBeInTheDocument();
    expect(await screen.findByText('Station 1')).toBeInTheDocument();
    expect(await screen.findByText('Station 2')).toBeInTheDocument();
  });

  it('renders defect feed entries from stub data', async () => {
    renderWithProviders(<LiveStationsPage />);
    expect(await screen.findByText('Cratère')).toBeInTheDocument();
    expect(await screen.findByText('Bavure')).toBeInTheDocument();
  });
});
