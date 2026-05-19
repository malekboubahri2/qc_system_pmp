import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/api/products';

const PRODUCT_KEY = 'products';
const TYPE_KEY = 'defect-types';
const CAT_KEY = 'category-constants';

// ── Products ─────────────────────────────────────────────────────
export function useProducts(includeArchived = false) {
  return useQuery({
    queryKey: [PRODUCT_KEY, { includeArchived }],
    queryFn: () => api.listProducts(includeArchived),
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createProduct,
    onSuccess: () => qc.invalidateQueries({ queryKey: [PRODUCT_KEY] }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: { name?: string } }) =>
      api.updateProduct(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [PRODUCT_KEY] }),
  });
}

export function useArchiveProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.archiveProduct,
    onSuccess: () => qc.invalidateQueries({ queryKey: [PRODUCT_KEY] }),
  });
}

// ── Defect types ─────────────────────────────────────────────────
export function useDefectTypes(
  productId: number,
  categoryKind?: string,
  includeArchived = false,
) {
  return useQuery({
    queryKey: [TYPE_KEY, { productId, categoryKind, includeArchived }],
    queryFn: () => api.listDefectTypes(productId, categoryKind, includeArchived),
    enabled: productId > 0,
  });
}

export function useCreateDefectType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      productId,
      body,
    }: {
      productId: number;
      body: { category_kind: string; label: string; display_order?: number };
    }) => api.createDefectType(productId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [TYPE_KEY] }),
  });
}

export function useUpdateDefectType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      productId,
      typeId,
      body,
    }: {
      productId: number;
      typeId: number;
      body: { label?: string; display_order?: number };
    }) => api.updateDefectType(productId, typeId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [TYPE_KEY] }),
  });
}

export function useArchiveDefectType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, typeId }: { productId: number; typeId: number }) =>
      api.archiveDefectType(productId, typeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [TYPE_KEY] }),
  });
}

// ── Category constants ────────────────────────────────────────────
export function useCategoryConstants() {
  return useQuery({
    queryKey: [CAT_KEY],
    queryFn: api.getCategories,
    staleTime: Infinity,
  });
}
