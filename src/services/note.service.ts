import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors';
import type { CreateNoteInput } from '@/schemas/note.schema';

export interface NoteDTO {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
}

function toDTO(raw: {
  id: string;
  title: string;
  description: string | null;
  created_at: Date | null;
}): NoteDTO {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    createdAt: raw.created_at ? raw.created_at.toISOString() : new Date().toISOString(),
  };
}

/**
 * Lista todas as notas do usuário autenticado.
 * SEGURANÇA: sempre escopado por userId.
 */
export async function listNotes(userId: string): Promise<NoteDTO[]> {
  const rows = await prisma.notes.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'asc' },
  });
  return rows.map(toDTO);
}

/**
 * Cria uma nova nota para o usuário autenticado.
 * SEGURANÇA: user_id vem exclusivamente do contexto de auth.
 */
export async function createNote(
  userId: string,
  input: CreateNoteInput
): Promise<NoteDTO> {
  const row = await prisma.notes.create({
    data: {
      user_id: userId,
      title: input.title,
      description: input.description ?? null,
    },
  });
  return toDTO(row);
}

/**
 * Remove uma nota. Verifica ownership antes de deletar.
 * SEGURANÇA: retorna 404 mesmo quando a nota existe mas pertence a outro usuário.
 */
export async function deleteNote(userId: string, noteId: string): Promise<void> {
  const existing = await prisma.notes.findUnique({
    where: { id: noteId },
    select: { user_id: true },
  });

  if (!existing || existing.user_id !== userId) {
    throw new NotFoundError('Nota não encontrada.');
  }

  await prisma.notes.delete({
    where: { id: noteId },
  });
}
