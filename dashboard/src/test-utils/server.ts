import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  FIXTURE_USER, FIXTURE_OPERATOR, FIXTURE_PRODUCT, FIXTURE_CATEGORIES,
  FIXTURE_TYPE, FIXTURE_TYPE_FALLBACK,
  FIXTURE_DEVICE, FIXTURE_LOGS, FIXTURE_FLAG,
  FIXTURE_SUMMARY, FIXTURE_BY_DEFECT, FIXTURE_BY_OPERATOR, FIXTURE_HEATMAP,
  FIXTURE_HOURLY_REPORT,
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

  // Products
  http.get(`${BASE}/products`, () => HttpResponse.json([FIXTURE_PRODUCT])),
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
  http.get(`${BASE}/devices`, () => HttpResponse.json([FIXTURE_DEVICE])),

  // Logs
  http.get(`${BASE}/logs`, () => HttpResponse.json(FIXTURE_LOGS)),

  // Inspection logs
  http.get(`${BASE}/inspection-logs/reports/hourly`, () =>
    HttpResponse.json(FIXTURE_HOURLY_REPORT),
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
