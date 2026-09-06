import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedContext } from '@/lib/api-handler';
import { createAccountSchema } from '@/schemas/account.schema';
import { listAccounts, createAccount } from '@/services/account.service';

// ─── Contrato: GET /api/accounts ──────────────────────────────────────────────
// Auth:     Bearer JWT obrigatório
// Response: 200 { accounts: AccountDTO[] }
// Erros:    401 (sem/token inválido)
//
// ─── Contrato: POST /api/accounts ─────────────────────────────────────────────
// Auth:     Bearer JWT obrigatório
// Body:     { name: string, emoji?, color?, anchorDate?, anchorBalance?, parentAccountId? }
// Response: 201 { account: AccountDTO }
// Erros:    400 (Zod), 401, 500

export const GET = withAuth(async (_req: NextRequest, ctx: AuthenticatedContext) => {
  const accounts = await listAccounts(ctx.userId);
  return NextResponse.json({ accounts }, { status: 200 });
});

export const POST = withAuth(async (req: NextRequest, ctx: AuthenticatedContext) => {
  const body = await req.json();
  const input = createAccountSchema.parse(body);
  const account = await createAccount(ctx.userId, input);
  return NextResponse.json({ account }, { status: 201 });
});
