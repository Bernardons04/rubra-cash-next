import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedContext } from '@/lib/api-handler';
import { updateAccountSchema } from '@/schemas/account.schema';
import { updateAccount, deleteAccount } from '@/services/account.service';

// ─── Contrato: PATCH /api/accounts/[id] ───────────────────────────────────────
// Auth:     Bearer JWT obrigatório
// Params:   id (UUID da account)
// Body:     Campos parciais: { name?, emoji?, color?, anchorDate?, anchorBalance?, parentAccountId? }
// Response: 200 { account: AccountDTO }
// Erros:    400 (Zod / body vazio), 401, 403 (conta de outro user), 404, 500
//
// ─── Contrato: DELETE /api/accounts/[id] ──────────────────────────────────────
// Auth:     Bearer JWT obrigatório
// Params:   id (UUID da account)
// Response: 204 No Content
// Erros:    401, 403, 404, 500

type RouteParams = { id: string };

export const PATCH = withAuth(
  async (req: NextRequest, ctx: AuthenticatedContext, params?: RouteParams) => {
    const accountId = params?.id;
    if (!accountId) {
      return NextResponse.json({ error: 'ID da conta não fornecido.' }, { status: 400 });
    }

    const body = await req.json();
    const input = updateAccountSchema.parse(body);
    const account = await updateAccount(ctx.userId, accountId, input);
    return NextResponse.json({ account }, { status: 200 });
  }
);

export const DELETE = withAuth(
  async (_req: NextRequest, ctx: AuthenticatedContext, params?: RouteParams) => {
    const accountId = params?.id;
    if (!accountId) {
      return NextResponse.json({ error: 'ID da conta não fornecido.' }, { status: 400 });
    }

    await deleteAccount(ctx.userId, accountId);
    return new NextResponse(null, { status: 204 });
  }
);
