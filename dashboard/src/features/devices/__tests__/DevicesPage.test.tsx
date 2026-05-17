import { screen } from '@testing-library/react';
import { DevicesPage } from '@/features/devices';
import { renderWithProviders } from '@/test-utils/render';

describe('DevicesPage', () => {
  it('renders heading, device id, and online badge', async () => {
    renderWithProviders(<DevicesPage />);

    expect(await screen.findByRole('heading', { name: /Appareils/i })).toBeInTheDocument();
    // Fixture device id — proves the device table loaded
    expect(await screen.findByText('qc-stm32-pilot01')).toBeInTheDocument();
    // Online badge — proves the online computed field is rendered
    expect(await screen.findByText('En ligne')).toBeInTheDocument();
  });
});
