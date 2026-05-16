import { z } from 'zod';

export const categorySchema = z.object({
  name: z.string().min(1, 'Nom requis').max(64, '64 caractères max'),
});
export type CategoryForm = z.infer<typeof categorySchema>;

export const typeSchema = z.object({
  label: z.string().min(1, 'Libellé requis').max(24, '24 caractères max'),
  category_id: z.number().int().positive(),
});
export type TypeForm = z.infer<typeof typeSchema>;

export const operatorSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(64, '64 caractères max'),
});
export type OperatorForm = z.infer<typeof operatorSchema>;

export const pinSchema = z.object({
  pin: z.string().regex(/^\d{4,8}$/, 'PIN : 4 à 8 chiffres numériques'),
});
export type PinForm = z.infer<typeof pinSchema>;

export const logFilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  operator_id: z.number().optional(),
  defect_type_id: z.number().optional(),
});
