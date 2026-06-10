import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  FIXTURE_USER, FIXTURE_OPERATOR, FIXTURE_PRODUCT, FIXTURE_CATEGORIES,
  FIXTURE_TYPE, FIXTURE_TYPE_FALLBACK,
  FIXTURE_DEVICE, FIXTURE_LOGS, FIXTURE_FLAG,
  FIXTURE_SUMMARY, FIXTURE_BY_DEFECT, FIXTURE_BY_OPERATOR, FIXTURE_HEATMAP,
  FIXTURE_HOURLY_REPORT, FIXTURE_LIVE_STATIONS, FIXTURE_LIVE_PRODUCTS,
} from './fixtures';

// In vitest/Node.js, axios uses the fetch adapter with baseURL='/api'.
// Relative baseURLs produce requests with no hostname, e.g. GET /api/operators.
// MSW v2 node mode matches relative URL patterns against pathname-only requests.
const BASE = '/api';

export const handlers = [
  // Auth
  http.get(`${BASE}/auth/me`, () => HttpResponse.json(FIXTURE_USER)),

  // Operators
  http.get(`${BASE}/operators`, () => HttpResponse.json([FIXTURE_OPERATOR])),

  // Products — /products/live must precede /:productId so it isn't captured.
  http.get(`${BASE}/products`, () => HttpResponse.json([FIXTURE_PRODUCT])),
  http.get(`${BASE}/products/live`, () => HttpResponse.json(FIXTURE_LIVE_PRODUCTS)),
  http.post(`${BASE}/products`, async ({ request }) => {
    const body = await request.json() as { name: string };
    return HttpResponse.json({ ...FIXTURE_PRODUCT, name: body.name }, { status: 201 });
  }),
  http.get(`${BASE}/products/:productId`, () => HttpResponse.json(FIXTURE_PRODUCT)),

  // Defect types (product-scoped)
  http.get(`${BASE}/products/:productId/defect-types`, () =>
    HttpResponse.json([FIXTURE_TYPE, FIXTURE_TYPE_FALLBACK]),
  ),
  http.post(`${BASE}/products/:productId/defect-types`, async ({ request }) => {
    const body = await request.json() as { label: string; category_kind: string };
    return HttpResponse.json({ ...FIXTURE_TYPE, label: body.label }, { status: 201 });
  }),

  // Category constants
  http.get(`${BASE}/constants/categories`, () => HttpResponse.json(FIXTURE_CATEGORIES)),

  // Devices
  http.get(`${BASE}/devices/live`, () => HttpResponse.json(FIXTURE_LIVE_STATIONS)),
  http.get(`${BASE}/devices`, () => HttpResponse.json([FIXTURE_DEVICE])),
  http.post(`${BASE}/devices/heartbeat`, () => new HttpResponse(null, { status: 204 })),

  // Logs
  http.get(`${BASE}/logs`, () => HttpResponse.json(FIXTURE_LOGS)),

  // Inspection logs
  http.get(`${BASE}/inspection-logs/reports/hourly`, () =>
    HttpResponse.json(FIXTURE_HOURLY_REPORT),
  ),

  // KPI snapshot (global Taux NC + cadence on the dashboard home)
  http.get(`${BASE}/kpi`, () =>
    HttpResponse.json({
      date: '2026-06-05',
      inspected_parts: 40,
      nc_parts: 6,
      ok_parts: 34,
      nc_rate: 0.15,
      defect_count: 9,
      last_hour_parts: 5,
      updated_at: '2026-06-05T10:00:00Z',
    }),
  ),

  // Stats
  http.get(`${BASE}/stats/summary`, () => HttpResponse.json(FIXTURE_SUMMARY)),
  http.get(`${BASE}/stats/by-defect`, () => HttpResponse.json(FIXTURE_BY_DEFECT)),
  http.get(`${BASE}/stats/by-operator`, () => HttpResponse.json(FIXTURE_BY_OPERATOR)),
  http.get(`${BASE}/stats/heatmap`, () => HttpResponse.json(FIXTURE_HEATMAP)),

  // Feature flags
  http.get(`${BASE}/flags`, () => HttpResponse.json([FIXTURE_FLAG])),
  http.put(`${BASE}/flags/:name`, async ({ request }) => {
    const body = await request.json() as { enabled: boolean };
    return HttpResponse.json({ ...FIXTURE_FLAG, enabled: body.enabled });
  }),
];

export const server = setupServer(...handlers);
