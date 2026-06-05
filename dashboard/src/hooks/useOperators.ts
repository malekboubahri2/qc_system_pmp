import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/api/operators';

const KEY = 'operators';

export function useOperators(includeArchived = false) {
  return useQuery({
    queryKey: [KEY, { includeArchived }],
    queryFn: () => api.listOperators(includeArchived),
  });
}

export function useCreateOperator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: api.OperatorInput) => api.createOperator(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateOperator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<Omit<api.OperatorInput, 'matricule'>> }) =>
      api.updateOperator(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useRegeneratePassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.regeneratePassword(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useArchiveOperator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.archiveOperator,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
