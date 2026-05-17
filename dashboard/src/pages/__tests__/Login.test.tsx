import { screen } from '@testing-library/react';
import { LoginPage } from '@/pages/Login';
import { renderWithProviders } from '@/test-utils/render';

describe('LoginPage', () => {
  it('renders brand heading and login form inputs', async () => {
    renderWithProviders(<LoginPage />);

    expect(await screen.findByRole('heading', { name: /Contrôle Qualité/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Adresse e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mot de passe/i)).toBeInTheDocument();
  });
});
