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

  it('reveals the one-time generated PIN after creating an operator', async () => {
    server.use(
      http.post('/api/operators', async ({ request }) => {
        const body = (await request.json()) as { name: string };
        return HttpResponse.json(
          {
            id: 9, name: body.name, pin_set: true, active: true,
            created_at: '2026-06-04T00:00:00Z', pin: '048213',
          },
          { status: 201 },
        );
      }),
    );

    renderWithProviders(<OperatorsPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Nouvel opérateur/ }));
    fireEvent.change(await screen.findByPlaceholderText(/Ahmed Ben Ali/), {
      target: { value: 'Sofia' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }));

    expect(await screen.findByText('048213')).toBeInTheDocument();
  });
});
