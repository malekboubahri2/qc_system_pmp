import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/api/defects';

const CAT_KEY = 'defect-categories';
const TYPE_KEY = 'defect-types';

// ── Categories ──────────────────────────────────────────────────
export function useCategories(includeArchived = false) {
  return useQuery({
    queryKey: [CAT_KEY, { includeArchived }],
    queryFn: () => api.listCategories(includeArchived),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: [CAT_KEY] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: { name?: string } }) =>
      api.updateCategory(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [CAT_KEY] }),
  });
}

export function useArchiveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.archiveCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: [CAT_KEY] }),
  });
}

// ── Types ────────────────────────────────────────────────────────
export function useTypes(categoryId?: number, includeArchived = false) {
  return useQuery({
    queryKey: [TYPE_KEY, { categoryId, includeArchived }],
    queryFn: () => api.listTypes(categoryId, includeArchived),
  });
}

export function useCreateType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createType,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TYPE_KEY] });
      qc.invalidateQueries({ queryKey: [CAT_KEY] }); // refresh defect_count
    },
  });
}

export function useUpdateType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: { label?: string } }) =>
      api.updateType(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [TYPE_KEY] }),
  });
}

export function useArchiveType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.archiveType,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TYPE_KEY] });
      qc.invalidateQueries({ queryKey: [CAT_KEY] }); // refresh defect_count
    },
  });
}
