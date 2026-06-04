import { useMutation } from '@tanstack/react-query';
import { createInspection } from '@/api/inspections';
import type { InspectionCreate } from '@/types';

// Submits one part inspection. The offline queue (next slice) will wrap this so
// submissions survive Wi-Fi drops; for now it posts directly.
export function useSubmitInspection() {
  return useMutation({
    mutationFn: (body: InspectionCreate) => createInspection(body),
  });
}
