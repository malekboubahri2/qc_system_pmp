import { client } from './client';
import type { Product, DefectType, CategoryConstant } from '@/types';

// ── Products ─────────────────────────────────────────────────────
export async function listProducts(includeArchived = false): Promise<Product[]> {
  const { data } = await client.get<Product[]>('/products', {
    params: includeArchived ? { include_archived: true } : undefined,
  });
  return data;
}

export async function createProduct(body: { name: string }): Promise<Product> {
  const { data } = await client.post<Product>('/products', body);
  return data;
}

export async function updateProduct(
  id: number,
  body: { name?: string },
): Promise<Product> {
  const { data } = await client.patch<Product>(`/products/${id}`, body);
  return data;
}

export async function archiveProduct(id: number): Promise<void> {
  await client.delete(`/products/${id}`);
}

// ── Defect types (product-scoped) ────────────────────────────────
export async function listDefectTypes(
  productId: number,
  categoryKind?: string,
  includeArchived = false,
): Promise<DefectType[]> {
  const { data } = await client.get<DefectType[]>(
    `/products/${productId}/defect-types`,
    {
      params: {
        ...(categoryKind ? { category_kind: categoryKind } : {}),
        ...(includeArchived ? { include_archived: true } : {}),
      },
    },
  );
  return data;
}

export async function createDefectType(
  productId: number,
  body: { category_kind: string; label: string; display_order?: number },
): Promise<DefectType> {
  const { data } = await client.post<DefectType>(
    `/products/${productId}/defect-types`,
    body,
  );
  return data;
}

export async function updateDefectType(
  productId: number,
  typeId: number,
  body: { label?: string; display_order?: number },
): Promise<DefectType> {
  const { data } = await client.patch<DefectType>(
    `/products/${productId}/defect-types/${typeId}`,
    body,
  );
  return data;
}

export async function archiveDefectType(
  productId: number,
  typeId: number,
): Promise<void> {
  await client.delete(`/products/${productId}/defect-types/${typeId}`);
}

// ── Constants ────────────────────────────────────────────────────
export async function getCategories(): Promise<CategoryConstant[]> {
  const { data } = await client.get<CategoryConstant[]>('/constants/categories');
  return data;
}
