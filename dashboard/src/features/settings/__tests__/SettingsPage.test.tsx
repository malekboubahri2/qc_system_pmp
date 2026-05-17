import { screen } from '@testing-library/react';
import { SettingsPage } from '@/features/settings';
import { renderWithProviders } from '@/test-utils/render';

describe('SettingsPage', () => {
  it('renders heading and at least one feature flag toggle', async () => {
    renderWithProviders(<SettingsPage />);

    expect(await screen.findByRole('heading', { name: /Paramètres/i })).toBeInTheDocument();
    // Radix Switch renders with role="switch" — proves the flag loaded and a toggle was rendered
    expect(await screen.findByRole('switch')).toBeInTheDocument();
  });
});
