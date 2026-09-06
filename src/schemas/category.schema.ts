import { z } from 'zod';

export const saveCategoriesSchema = z.record(
  z.string().min(1, 'Nome da categoria é obrigatório').max(100),
  z.array(z.string().min(1, 'Nome da subcategoria não pode ser vazio').max(100))
);

export type SaveCategoriesInput = z.infer<typeof saveCategoriesSchema>;
