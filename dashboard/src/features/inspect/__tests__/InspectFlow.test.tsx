import { beforeEach, describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test-utils/server';
import { InspectApp } from '../InspectApp';

const OPERATOR_ME = {
  id: 7, email: 'mohammed', role: 'operator', operator_id: 1, operator_name: 'Mohammed',
};

describe('inspection PWA flow (ADR-018: operator login → product → PMP → INJ → summary)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('qc_token', 'operator-token');
    server.use(http.get('/api/auth/me', () => HttpResponse.json(OPERATOR_ME)));
  });

  it('logs a part and shows the Taux NC on confirmation', async () => {
    let posted: Record<string, unknown> | null = null;
    server.use(
      http.post('/api/inspections', async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ part_inspection_id: 'abc' }, { status: 201 });
      }),
      http.get('/api/kpi', () =>
        HttpResponse.json({
          date: '2026-06-05', inspected_parts: 5, nc_parts: 1, ok_parts: 4,
          nc_rate: 0.2, defect_count: 1, last_hour_parts: 3, updated_at: '2026-06-05T10:00:00Z',
        }),
      ),
    );

    render(<InspectApp />);

    // Product picker (operator came from /auth/me, no name-grid/PIN)
    fireEvent.click(await screen.findByRole('button', { name: /Capot moteur/ }));

    // PMP page → pick a defect → go to INJECTION
    fireEvent.click(await screen.findByRole('button', { name: 'Coulure' }));
    fireEvent.click(screen.getByRole('button', { name: /Injection/ }));

    // INJECTION page (no types) → go to summary
    fireEvent.click(await screen.findByRole('button', { name: /Vérifier/ }));

    // Summary merges the review + the running Taux NC (the operator's rate
    // today) on one screen; saving advances to the next part.
    expect(await screen.findByText(/1 défaut signalé/)).toBeInTheDocument();
    expect(await screen.findByText('20%')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    // Submission carried the part but no operator_id (server attributes it).
    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted).toMatchObject({ product_id: 1, pmp_defect_type_ids: [1], inj_defect_type_ids: [] });
    expect(posted).not.toHaveProperty('operator_id');
  });
});
