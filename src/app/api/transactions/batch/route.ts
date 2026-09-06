import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedContext } from '@/lib/api-handler';
import { batchSaveTransactionsSchema, batchDeleteTransactionsSchema } from '@/schemas/transaction.schema';
import { saveTransactionsBatch, deleteTransactionsBatch } from '@/services/transaction.service';

export const POST = withAuth(async (req: NextRequest, ctx: AuthenticatedContext) => {
  const body = await req.json();
  const input = batchSaveTransactionsSchema.parse(body);
  await saveTransactionsBatch(ctx.userId, input);
  return NextResponse.json({ success: true }, { status: 201 });
});

export const DELETE = withAuth(async (req: NextRequest, ctx: AuthenticatedContext) => {
  const body = await req.json();
  const input = batchDeleteTransactionsSchema.parse(body);
  await deleteTransactionsBatch(ctx.userId, input.ids);
  return new NextResponse(null, { status: 204 });
});
