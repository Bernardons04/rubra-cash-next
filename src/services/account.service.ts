import { prisma } from '@/lib/prisma';
import { NotFoundError, ValidationError } from '@/lib/errors';
import type { CreateAccountInput, UpdateAccountInput } from '@/schemas/account.schema';
import { Decimal } from '@prisma/client/runtime/library';

// Tipo de retorno público — snake_case do Prisma mapeado para camelCase
export interface AccountDTO {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  anchorDate: string | null;   // ISO date string YYYY-MM-DD
  anchorBalance: number | null;
  parentAccountId: string | null;
  createdAt: string;
}

function toDTO(raw: {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  anchor_date: Date | null;
  anchor_balance: Decimal | null;
  parent_account_id: string | null;
  created_at: Date | null;
}): AccountDTO {
  return {
    id: raw.id,
    name: raw.name,
    emoji: raw.emoji,
    color: raw.color,
    anchorDate: raw.anchor_date ? raw.anchor_date.toISOString().split('T')[0] : null,
    anchorBalance: raw.anchor_balance !== null ? Number(raw.anchor_balance) : null,
    parentAccountId: raw.parent_account_id,
    createdAt: raw.created_at ? raw.created_at.toISOString() : new Date().toISOString(),
  };
}

/**
 * Verifica que parentAccountId, se fornecido, pertence ao mesmo userId.
 * Lança ValidationError para não revelar a existência de accounts de outros usuários
 * e impedir referências cruzadas entre usuários.
 */
async function validateParentOwnership(
  userId: string,
  parentAccountId: string
): Promise<void> {
  const parent = await prisma.accounts.findUnique({
    where: { id: parentAccountId },
    select: { user_id: true },
  });

  if (!parent || parent.user_id !== userId) {
    throw new ValidationError('parentAccountId inválido ou não pertence ao usuário.');
  }
}

/**
 * Lista todas as accounts do usuário autenticado.
 * SEGURANÇA: sempre escopado por userId.
 */
export async function listAccounts(userId: string): Promise<AccountDTO[]> {
  const rows = await prisma.accounts.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'asc' },
  });
  return rows.map(toDTO);
}

/**
 * Cria uma nova account para o usuário autenticado.
 * SEGURANÇA: user_id vem exclusivamente do contexto de auth, nunca do body.
 * Valida que parentAccountId, se fornecido, pertence ao mesmo userId.
 */
export async function createAccount(
  userId: string,
  input: CreateAccountInput
): Promise<AccountDTO> {
  if (input.parentAccountId) {
    await validateParentOwnership(userId, input.parentAccountId);
  }

  const row = await prisma.accounts.create({
    data: {
      user_id: userId,
      name: input.name,
      emoji: input.emoji ?? null,
      color: input.color ?? null,
      anchor_date: input.anchorDate ? new Date(input.anchorDate) : null,
      anchor_balance:
        input.anchorBalance !== undefined && input.anchorBalance !== null
          ? new Decimal(input.anchorBalance)
          : null,
      parent_account_id: input.parentAccountId ?? null,
    },
  });
  return toDTO(row);
}

/**
 * Atualiza uma account. Verifica ownership antes de atualizar.
 * SEGURANÇA:
 * - Retorna 404 mesmo quando a conta existe mas pertence a outro usuário
 *   (não revela a existência de recursos de outros usuários).
 * - Verifica ownership de parentAccountId se fornecido.
 * - Impede auto-referência circular (conta não pode ser pai dela mesma).
 */
export async function updateAccount(
  userId: string,
  accountId: string,
  input: UpdateAccountInput
): Promise<AccountDTO> {
  const existing = await prisma.accounts.findUnique({
    where: { id: accountId },
    select: { id: true, user_id: true },
  });

  // 404 intencional: não revelamos se a conta existe mas pertence a outro usuário
  if (!existing || existing.user_id !== userId) {
    throw new NotFoundError('Conta não encontrada.');
  }

  // Impede que a conta seja pai dela mesma
  if (input.parentAccountId === accountId) {
    throw new ValidationError('Uma conta não pode ser pai dela mesma.');
  }

  // Verifica ownership do parentAccountId se estiver sendo alterado
  if (input.parentAccountId) {
    await validateParentOwnership(userId, input.parentAccountId);
  }

  const row = await prisma.accounts.update({
    where: { id: accountId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.emoji !== undefined && { emoji: input.emoji }),
      ...(input.color !== undefined && { color: input.color }),
      ...(input.anchorDate !== undefined && {
        anchor_date: input.anchorDate ? new Date(input.anchorDate) : null,
      }),
      ...(input.anchorBalance !== undefined && {
        anchor_balance:
          input.anchorBalance !== null ? new Decimal(input.anchorBalance) : null,
      }),
      ...(input.parentAccountId !== undefined && {
        parent_account_id: input.parentAccountId,
      }),
    },
  });

  return toDTO(row);
}

/**
 * Remove uma account. Verifica ownership antes de deletar.
 * SEGURANÇA: retorna 404 mesmo quando a conta existe mas pertence a outro usuário.
 */
export async function deleteAccount(
  userId: string,
  accountId: string
): Promise<void> {
  const existing = await prisma.accounts.findUnique({
    where: { id: accountId },
    select: { user_id: true },
  });

  // 404 intencional: não revelamos se a conta existe mas pertence a outro usuário
  if (!existing || existing.user_id !== userId) {
    throw new NotFoundError('Conta não encontrada.');
  }

  await prisma.accounts.delete({
    where: { id: accountId },
  });
}
