import { prisma } from '@/lib/prisma';
import { NotFoundError, ValidationError } from '@/lib/errors';
import type { CreateTransactionInput, UpdateTransactionInput, BatchSaveTransactionsInput } from '@/schemas/transaction.schema';
import { Decimal } from '@prisma/client/runtime/library';

export interface TransactionDTO {
  id: string;
  title: string;
  amount: number;
  type: string;
  date: string;
  category: string | null;
  subcategory: string | null;
  method: string | null;
  direction: string | null;
  accountId: string | null;
  counterpartAccountId: string | null;
}

function toDTO(raw: {
  id: string;
  title: string;
  amount: Decimal;
  type: string;
  date: Date;
  category: string | null;
  subcategory: string | null;
  method: string | null;
  direction: string | null;
  account_id: string | null;
  counterpart_account_id: string | null;
}): TransactionDTO {
  return {
    id: raw.id,
    title: raw.title,
    amount: Number(raw.amount),
    type: raw.type,
    date: raw.date.toISOString().split('T')[0],
    category: raw.category,
    subcategory: raw.subcategory,
    method: raw.method,
    direction: raw.direction,
    accountId: raw.account_id,
    counterpartAccountId: raw.counterpart_account_id,
  };
}

/**
 * Valida ownership das accounts envolvidas na transação.
 * E impede que a mesma conta seja origem e destino.
 */
async function validateAccountsOwnership(userId: string, accountId?: string | null, counterpartAccountId?: string | null) {
  if (accountId && counterpartAccountId && accountId === counterpartAccountId) {
    throw new ValidationError('A conta de origem e destino não podem ser a mesma.');
  }

  const ids = new Set<string>();
  if (accountId) ids.add(accountId);
  if (counterpartAccountId) ids.add(counterpartAccountId);
  
  if (ids.size === 0) return;

  const accounts = await prisma.accounts.findMany({
    where: { id: { in: Array.from(ids) } },
    select: { id: true, user_id: true }
  });

  if (accounts.length !== ids.size) {
    throw new ValidationError('Uma ou mais contas não foram encontradas.');
  }

  for (const acc of accounts) {
    if (acc.user_id !== userId) {
      throw new ValidationError('Uma ou mais contas não pertencem ao usuário autenticado.');
    }
  }
}

export async function listTransactions(userId: string): Promise<TransactionDTO[]> {
  const rows = await prisma.transactions.findMany({
    where: { user_id: userId },
    orderBy: { date: 'desc' },
  });
  return rows.map(toDTO);
}

export async function createTransaction(userId: string, input: CreateTransactionInput): Promise<TransactionDTO> {
  await validateAccountsOwnership(userId, input.accountId, input.counterpartAccountId);

  const row = await prisma.transactions.create({
    data: {
      user_id: userId,
      title: input.title,
      amount: new Decimal(input.amount),
      type: input.type,
      date: new Date(input.date),
      category: input.category,
      subcategory: input.subcategory,
      method: input.method,
      direction: input.direction,
      account_id: input.accountId,
      counterpart_account_id: input.counterpartAccountId,
    },
  });
  return toDTO(row);
}

export async function updateTransaction(userId: string, id: string, input: UpdateTransactionInput): Promise<TransactionDTO> {
  const existing = await prisma.transactions.findUnique({
    where: { id },
    select: { user_id: true },
  });

  if (!existing || existing.user_id !== userId) {
    throw new NotFoundError('Transação não encontrada.');
  }

  await validateAccountsOwnership(userId, input.accountId, input.counterpartAccountId);

  const row = await prisma.transactions.update({
    where: { id },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.amount !== undefined && { amount: new Decimal(input.amount) }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.date !== undefined && { date: input.date ? new Date(input.date) : undefined }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.subcategory !== undefined && { subcategory: input.subcategory }),
      ...(input.method !== undefined && { method: input.method }),
      ...(input.direction !== undefined && { direction: input.direction }),
      ...(input.accountId !== undefined && { account_id: input.accountId }),
      ...(input.counterpartAccountId !== undefined && { counterpart_account_id: input.counterpartAccountId }),
    },
  });

  return toDTO(row);
}

export async function deleteTransaction(userId: string, id: string): Promise<void> {
  const existing = await prisma.transactions.findUnique({
    where: { id },
    select: { user_id: true },
  });

  if (!existing || existing.user_id !== userId) {
    throw new NotFoundError('Transação não encontrada.');
  }

  await prisma.transactions.delete({ where: { id } });
}

export async function deleteTransactionsBatch(userId: string, ids: string[]): Promise<void> {
  // Somente deleta as transações que pertencem ao usuário.
  await prisma.transactions.deleteMany({
    where: {
      id: { in: ids },
      user_id: userId,
    }
  });
}

export async function saveTransactionsBatch(userId: string, input: BatchSaveTransactionsInput): Promise<void> {
  // Vamos extrair todos os accountIds para validação em lote
  const accountIds = new Set<string>();
  for (const tx of input.transactions) {
    if (tx.accountId) accountIds.add(tx.accountId);
    if (tx.counterpartAccountId) accountIds.add(tx.counterpartAccountId);
  }

  if (accountIds.size > 0) {
    const accounts = await prisma.accounts.findMany({
      where: { id: { in: Array.from(accountIds) } },
      select: { id: true, user_id: true }
    });
    
    if (accounts.length !== accountIds.size) {
      throw new ValidationError('Uma ou mais contas no lote não foram encontradas.');
    }
    for (const acc of accounts) {
      if (acc.user_id !== userId) {
        throw new ValidationError('Uma ou mais contas no lote não pertencem ao usuário.');
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    const batch = await tx.import_batches.create({
      data: {
        user_id: userId,
        file_name: input.metadata.name,
        // No banco é "file_size" mas no frontend era file_type / raw_text.
        // O frontend antigo enviava file_type no field 'file_type', 
        // mas o banco Rubra Cash so tem file_name, file_size, transaction_count, imported_at, created_at.
        // Vou salvar transaction_count.
        transaction_count: input.transactions.length,
      }
    });

    const txData = input.transactions.map(t => ({
      user_id: userId,
      import_batch_id: batch.id,
      title: t.title,
      amount: new Decimal(t.amount),
      type: t.type,
      date: new Date(t.date),
      category: t.category,
      subcategory: t.subcategory,
      method: t.method,
      direction: t.direction,
      account_id: t.accountId,
      counterpart_account_id: t.counterpartAccountId,
    }));

    await tx.transactions.createMany({ data: txData });
  });
}
