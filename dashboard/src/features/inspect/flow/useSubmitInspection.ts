import { useMutation } from '@tanstack/react-query';
import type { InspectionCreate } from '@/types';
import { submitOrQueue, type SubmitResult } from '../offline/submitOrQueue';

// Submits one part inspection, falling back to the offline queue when the
// network is down. Real server errors propagate so the UI can surface them.
export function useSubmitInspection() {
  return useMutation<SubmitResult, unknown, InspectionCreate>({
    mutationFn: (body) => submitOrQueue(body),
  });
}
