import { screen, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test-utils/server';
import { OperatorsPage } from '@/features/operators';
import { renderWithProviders } from '@/test-utils/render';

describe('OperatorsPage', () => {
  it('renders heading and at least one operator row', async () => {
    renderWithProviders(<OperatorsPage />);

    expect(await screen.findByRole('heading', { name: /Opérateurs/i })).toBeInTheDocument();
    // Fixture operator name — proves the table loaded
    expect(await screen.findByText('Mohammed')).toBeInTheDocument();
  });

  it('reveals the one-time generated credentials after creating an operator', async () => {
    server.use(
      http.post('/api/operators', async ({ request }) => {
        const body = (await request.json()) as { matricule: string; name: string };
        return HttpResponse.json(
          {
            id: 9, matricule: body.matricule, name: body.name,
            username: body.matricule, has_login: true,
            pin_set: false, active: true, created_at: '2026-06-04T00:00:00Z',
            password: 'kf7mq2pa',
          },
          { status: 201 },
        );
      }),
    );

    renderWithProviders(<OperatorsPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Nouvel opérateur/ }));
    fireEvent.change(await screen.findByPlaceholderText('ex. EMP-0427'), {
      target: { value: 'EMP-0427' },
    });
    fireEvent.change(screen.getByPlaceholderText('ex. Ahmed'), {
      target: { value: 'Sofia' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }));

    // Login (= matricule) and one-time password are both revealed.
    expect(await screen.findByText('EMP-0427')).toBeInTheDocument();
    expect(screen.getByText('kf7mq2pa')).toBeInTheDocument();
  });
});
