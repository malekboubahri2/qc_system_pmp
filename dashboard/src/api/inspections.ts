import { client } from './client';
import type { InspectionCreate, InspectionCreateResponse } from '@/types';

// POST one part inspection. The server expands it into per-defect rows
// (schema 4) and returns the shared part_inspection_id.
export async function createInspection(
  body: InspectionCreate,
): Promise<InspectionCreateResponse> {
  const { data } = await client.post<InspectionCreateResponse>('/inspections', body);
  return data;
}
