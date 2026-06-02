import { screen } from '@testing-library/react';
import { LiveStationsPage } from '@/features/live-stations';
import { renderWithProviders } from '@/test-utils/render';

describe('LiveStationsPage', () => {
  it('renders the page heading and the live station panel', async () => {
    renderWithProviders(<LiveStationsPage />);
    expect(await screen.findByRole('heading', { name: /Stations en direct/i })).toBeInTheDocument();
    expect(await screen.findByText('Station 1')).toBeInTheDocument();
    expect(await screen.findByText('qc-stm32-001a2b3c')).toBeInTheDocument();
  });

  it('renders the operator, product and defect feed from /devices/live', async () => {
    renderWithProviders(<LiveStationsPage />);
    expect(await screen.findByText('Mohammed')).toBeInTheDocument();
    expect(await screen.findByText('Capot moteur')).toBeInTheDocument();
    expect(await screen.findByText('Coulure')).toBeInTheDocument();
    expect(await screen.findByText('Bavure')).toBeInTheDocument();
  });

  it('renders the OK part count for the station', async () => {
    renderWithProviders(<LiveStationsPage />);
    expect(await screen.findByText('12 OK')).toBeInTheDocument();
  });
});
