import { client } from './client';
import type { DefectCategory, DefectType } from '@/types';

// ── Categories ──────────────────────────────────────────────────
export async function listCategories(includeArchived = false): Promise<DefectCategory[]> {
  const { data } = await client.get<DefectCategory[]>('/defect-categories', {
    params: includeArchived ? { include_archived: true } : undefined,
  });
  return data;
}

export async function createCategory(body: { name: string; display_order?: number }): Promise<DefectCategory> {
  const { data } = await client.post<DefectCategory>('/defect-categories', body);
  return data;
}

export async function updateCategory(
  id: number,
  body: { name?: string; display_order?: number },
): Promise<DefectCategory> {
  const { data } = await client.patch<DefectCategory>(`/defect-categories/${id}`, body);
  return data;
}

export async function archiveCategory(id: number): Promise<void> {
  await client.delete(`/defect-categories/${id}`);
}

// ── Types ────────────────────────────────────────────────────────
export async function listTypes(categoryId?: number, includeArchived = false): Promise<DefectType[]> {
  const { data } = await client.get<DefectType[]>('/defect-types', {
    params: {
      ...(categoryId != null ? { category_id: categoryId } : {}),
      ...(includeArchived ? { include_archived: true } : {}),
    },
  });
  return data;
}

export async function createType(body: {
  category_id: number;
  label: string;
  display_order?: number;
}): Promise<DefectType> {
  const { data } = await client.post<DefectType>('/defect-types', body);
  return data;
}

export async function updateType(
  id: number,
  body: { label?: string; display_order?: number },
): Promise<DefectType> {
  const { data } = await client.patch<DefectType>(`/defect-types/${id}`, body);
  return data;
}

export async function archiveType(id: number): Promise<void> {
  await client.delete(`/defect-types/${id}`);
}
