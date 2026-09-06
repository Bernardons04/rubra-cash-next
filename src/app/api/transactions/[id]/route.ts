import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedContext } from '@/lib/api-handler';
import { updateTransactionSchema } from '@/schemas/transaction.schema';
import { updateTransaction, deleteTransaction } from '@/services/transaction.service';

type RouteParams = { id: string };

export const PATCH = withAuth(
  async (req: NextRequest, ctx: AuthenticatedContext, params?: RouteParams) => {
    const transactionId = params?.id;
    if (!transactionId) {
      return NextResponse.json({ error: 'ID da transação não fornecido.' }, { status: 400 });
    }

    const body = await req.json();
    const input = updateTransactionSchema.parse(body);
    const transaction = await updateTransaction(ctx.userId, transactionId, input);
    return NextResponse.json({ transaction }, { status: 200 });
  }
);

export const DELETE = withAuth(
  async (_req: NextRequest, ctx: AuthenticatedContext, params?: RouteParams) => {
    const transactionId = params?.id;
    if (!transactionId) {
      return NextResponse.json({ error: 'ID da transação não fornecido.' }, { status: 400 });
    }

    await deleteTransaction(ctx.userId, transactionId);
    return new NextResponse(null, { status: 204 });
  }
);
