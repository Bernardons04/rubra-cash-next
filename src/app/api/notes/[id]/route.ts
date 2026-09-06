import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedContext } from '@/lib/api-handler';
import { deleteNote } from '@/services/note.service';

// ─── Contrato: DELETE /api/notes/[id] ─────────────────────────────────────────
// Auth:     Bearer JWT obrigatório
// Params:   id (UUID da nota)
// Response: 204 No Content
// Erros:    400, 401, 404, 500

type RouteParams = { id: string };

export const DELETE = withAuth(
  async (_req: NextRequest, ctx: AuthenticatedContext, params?: RouteParams) => {
    const noteId = params?.id;
    if (!noteId) {
      return NextResponse.json({ error: 'ID da nota não fornecido.' }, { status: 400 });
    }

    await deleteNote(ctx.userId, noteId);
    return new NextResponse(null, { status: 204 });
  }
);
