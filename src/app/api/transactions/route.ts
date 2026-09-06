import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedContext } from '@/lib/api-handler';
import { createTransactionSchema } from '@/schemas/transaction.schema';
import { listTransactions, createTransaction } from '@/services/transaction.service';

export const GET = withAuth(async (_req: NextRequest, ctx: AuthenticatedContext) => {
  const transactions = await listTransactions(ctx.userId);
  return NextResponse.json({ transactions }, { status: 200 });
});

export const POST = withAuth(async (req: NextRequest, ctx: AuthenticatedContext) => {
  const body = await req.json();
  const input = createTransactionSchema.parse(body);
  const transaction = await createTransaction(ctx.userId, input);
  return NextResponse.json({ transaction }, { status: 201 });
});
