import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  FIXTURE_USER, FIXTURE_OPERATOR, FIXTURE_CATEGORY, FIXTURE_TYPE,
  FIXTURE_DEVICE, FIXTURE_LOGS, FIXTURE_FLAG,
  FIXTURE_SUMMARY, FIXTURE_BY_DEFECT, FIXTURE_BY_OPERATOR, FIXTURE_HEATMAP,
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

  // Defect categories + types
  http.get(`${BASE}/defect-categories`, () => HttpResponse.json([FIXTURE_CATEGORY])),
  http.get(`${BASE}/defect-types`, () => HttpResponse.json([FIXTURE_TYPE])),

  // Devices
  http.get(`${BASE}/devices`, () => HttpResponse.json([FIXTURE_DEVICE])),

  // Logs
  http.get(`${BASE}/logs`, () => HttpResponse.json(FIXTURE_LOGS)),

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
