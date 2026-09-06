import { z } from 'zod';

// ─── Schema base de Account ─────────────────────────────────────────────────

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

export const accountBodySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  emoji: z.string().max(10).optional().nullable(),
  color: z.string().max(30).optional().nullable(),
  anchorDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'anchorDate deve estar no formato YYYY-MM-DD')
    .refine(isRealDate, { message: 'anchorDate deve ser uma data real do calendário.' })
    .optional()
    .nullable(),
  anchorBalance: z
    .number()
    .finite('anchorBalance deve ser um número finito.')
    .optional()
    .nullable(),
  parentAccountId: z
    .string()
    .uuid('parentAccountId deve ser um UUID válido')
    .optional()
    .nullable(),
});

// Schema de criação (todos os campos editáveis)
export const createAccountSchema = accountBodySchema;

// Schema de atualização (todos os campos são opcionais)
export const updateAccountSchema = accountBodySchema.partial().refine(
  data => Object.keys(data).length > 0,
  { message: 'É necessário enviar ao menos um campo para atualizar.' }
);

// Tipos inferidos
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

