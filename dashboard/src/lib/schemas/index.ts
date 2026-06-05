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

const optionalText = (max: number) =>
  z.string().max(max, `${max} caractères max`).optional().or(z.literal(''));

export const operatorSchema = z.object({
  matricule: z
    .string()
    .min(1, 'Matricule requis')
    .max(32, '32 caractères max')
    .regex(/^[A-Za-z0-9._-]+$/, 'Lettres, chiffres, . _ - uniquement'),
  name: z.string().min(1, 'Prénom requis').max(64, '64 caractères max'),
  last_name: optionalText(64),
  phone: optionalText(32),
  address: optionalText(255),
});
export type OperatorForm = z.infer<typeof operatorSchema>;

export const productSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(64, '64 caractères max'),
  reference: optionalText(64),
  client: optionalText(120),
  cheatsheet: optionalText(2000),
});
export type ProductForm = z.infer<typeof productSchema>;

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
