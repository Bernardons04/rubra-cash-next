import { z } from 'zod';

// new Date('2024-02-30') em V8 faz overflow para 2024-03-01, então apenas
// verificar !isNaN() não é suficiente. Revalidamos comparando os componentes.
function isRealDate(value: string): boolean {
  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const d = new Date(year, month - 1, day); // mês 0-indexed, sem timezone
  return (
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day
  );
}

export const transactionBodySchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(255),
  amount: z.number().finite('Amount deve ser um número finito'),
  type: z.enum(['income', 'expense', 'transfer']),
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date deve estar no formato YYYY-MM-DD')
    .refine(isRealDate, { message: 'Date deve ser uma data real do calendário.' }),
  category: z.string().nullable().optional(),
  subcategory: z.string().nullable().optional(),
  method: z.string().nullable().optional(),
  direction: z.enum(['in', 'out']).nullable().optional(),
  accountId: z.string().uuid('accountId deve ser um UUID válido').nullable().optional(),
  counterpartAccountId: z.string().uuid('counterpartAccountId deve ser um UUID válido').nullable().optional(),
});

export const createTransactionSchema = transactionBodySchema;

export const updateTransactionSchema = transactionBodySchema.partial().refine(
  data => Object.keys(data).length > 0,
  { message: 'É necessário enviar ao menos um campo para atualizar.' }
);

export const batchSaveTransactionsSchema = z.object({
  metadata: z.object({
    name: z.string(),
    type: z.string(),
    raw_text: z.string().optional(),
  }),
  transactions: z.array(transactionBodySchema),
});

export const batchDeleteTransactionsSchema = z.object({
  ids: z.array(z.string().uuid()),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type BatchSaveTransactionsInput = z.infer<typeof batchSaveTransactionsSchema>;
export type BatchDeleteTransactionsInput = z.infer<typeof batchDeleteTransactionsSchema>;
