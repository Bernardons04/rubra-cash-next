import { z } from 'zod';

export const createNoteSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(255),
  description: z.string().max(2000).optional().nullable(),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
