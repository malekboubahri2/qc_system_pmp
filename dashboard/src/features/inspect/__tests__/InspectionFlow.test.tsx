import { beforeEach, describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test-utils/server';
import { InspectApp } from '../InspectApp';

describe('inspection flow (operator → product → grid → summary → submit)', () => {
  beforeEach(() => {
    localStorage.clear();
    // Skip the one-time station sign-in by seeding its token.
    localStorage.setItem('qc_station_token', 'station-token');
  });

  it('logs a part with one defect end to end', async () => {
    let posted: Record<string, unknown> | null = null;
    server.use(
      http.post('/api/operators/verify-pin', () => new HttpResponse(null, { status: 204 })),
      http.post('/api/inspections', async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ part_inspection_id: 'abc123' }, { status: 201 });
      }),
    );

    render(<InspectApp />);

    // 1) Operator picker → tap the operator
    fireEvent.click(await screen.findByRole('button', { name: 'Mohammed' }));

    // 2) PIN pad → enter 4 digits and validate
    for (const d of ['1', '2', '3', '4']) {
      fireEvent.click(screen.getByRole('button', { name: d }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Valider' }));

    // 3) Product picker → tap the product
    fireEvent.click(await screen.findByRole('button', { name: /Capot moteur/ }));

    // 4) Defect grid → select a defect, then validate the part
    fireEvent.click(await screen.findByRole('button', { name: 'Coulure' }));
    fireEvent.click(screen.getByRole('button', { name: /Valider la pièce/ }));

    // 5) Summary → confirm and save
    expect(await screen.findByText(/1 défaut signalé/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    // Submission carried the right ids, and the flow resets for the next part.
    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted).toMatchObject({
      operator_id: 1,
      product_id: 1,
      pmp_defect_type_ids: [1],
      inj_defect_type_ids: [],
    });
    expect(await screen.findByRole('button', { name: /Pièce conforme/ })).toBeInTheDocument();
  });
});
