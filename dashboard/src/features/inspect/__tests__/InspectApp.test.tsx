import { beforeEach, describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test-utils/server';
import { InspectApp } from '../InspectApp';

describe('InspectApp (inspection PWA)', () => {
  beforeEach(() => {
    // Drop the admin qc_token the global setup seeds; the PWA uses its own key.
    localStorage.clear();
  });

  it('shows the station-login screen when no station token is stored', async () => {
    render(<InspectApp />);
    expect(await screen.findByText('Configuration du poste')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /activer le poste/i }),
    ).toBeInTheDocument();
  });

  it('activates the station and reveals the ready screen on successful login', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ access_token: 'station-token', token_type: 'bearer' }),
      ),
    );

    render(<InspectApp />);

    fireEvent.change(await screen.findByPlaceholderText('poste@qc.local'), {
      target: { value: 'poste@qc.local' },
    });
    fireEvent.change(screen.getByLabelText('Mot de passe'), {
      target: { value: 'secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: /activer le poste/i }));

    expect(await screen.findByText('Poste activé')).toBeInTheDocument();
    expect(localStorage.getItem('qc_station_token')).toBe('station-token');
  });
});
