import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedContext } from '@/lib/api-handler';
import { createNoteSchema } from '@/schemas/note.schema';
import { listNotes, createNote } from '@/services/note.service';

// ─── Contrato: GET /api/notes ─────────────────────────────────────────────────
// Auth:     Bearer JWT obrigatório
// Response: 200 { notes: NoteDTO[] }
// Erros:    401
//
// ─── Contrato: POST /api/notes ────────────────────────────────────────────────
// Auth:     Bearer JWT obrigatório
// Body:     { title: string, description?: string }
// Response: 201 { note: NoteDTO }
// Erros:    400 (Zod), 401, 500

export const GET = withAuth(async (_req: NextRequest, ctx: AuthenticatedContext) => {
  const notes = await listNotes(ctx.userId);
  return NextResponse.json({ notes }, { status: 200 });
});

export const POST = withAuth(async (req: NextRequest, ctx: AuthenticatedContext) => {
  const body = await req.json();
  const input = createNoteSchema.parse(body);
  const note = await createNote(ctx.userId, input);
  return NextResponse.json({ note }, { status: 201 });
});
