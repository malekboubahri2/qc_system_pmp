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
    mutationFn: (name: string) => api.createOperator(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateOperator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api.updateOperator(id, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useSetPin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pin }: { id: number; pin: string }) => api.setPin(id, pin),
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
