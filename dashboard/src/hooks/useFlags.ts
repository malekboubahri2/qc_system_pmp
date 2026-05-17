import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/api/flags';

const FLAGS_KEY = 'flags';

export function useFlags() {
  return useQuery({
    queryKey: [FLAGS_KEY],
    queryFn: api.listFlags,
    staleTime: 60_000,
  });
}

export function useUpdateFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      name,
      enabled,
      description,
    }: {
      name: string;
      enabled: boolean;
      description?: string | null;
    }) => api.updateFlag(name, { enabled, description }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [FLAGS_KEY] }),
  });
}
