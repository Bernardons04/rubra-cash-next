/**
 * orchestrator.ts
 *
 * Central de setup/teardown para testes de integração do Rubra Cash.
 * Usa:
 * - Supabase Client para autenticação (obter tokens JWT reais)
 * - Prisma para criação/limpeza de fixtures de dados (sem depender das rotas da API)
 */

import { createClient } from '@supabase/supabase-js';
import { Session } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { faker } from '@faker-js/faker';
import { prisma } from '../../src/lib/prisma';


// ─── Supabase client para autenticação nos testes ─────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Instâncias separadas para user1 e user2 (evita conflito de sessão)
const authClient1 = createClient(supabaseUrl, supabaseAnonKey);
const authClient2 = createClient(supabaseUrl, supabaseAnonKey);

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let adminClient: ReturnType<typeof createClient> | null = null;
if (supabaseServiceKey) {
  adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface TestUser {
  session: Session;
  userId: string;
  accessToken: string;
}

// Armazena estado dos usuários criados para reaproveitar durante o arquivo de testes
const activeUsers: Record<'user1' | 'user2', TestUser | null> = {
  user1: null,
  user2: null,
};

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

/**
 * Autentica um usuário de teste (cria no Supabase Auth se ainda não existir neste contexto).
 * Retorna { session, userId, accessToken }.
 */
export async function setupUser(envKey: 'user1' | 'user2'): Promise<TestUser> {
  if (!adminClient) {
    throw new Error(
      `SUPABASE_SERVICE_ROLE_KEY não encontrada no .env.test.local.\n` +
      `Ela é obrigatória para criar os usuários dinâmicos de teste.`
    );
  }

  // Se já criamos o usuário neste ciclo de testes, reaproveita.
  if (activeUsers[envKey]) {
    return activeUsers[envKey]!;
  }

  // Cria credenciais fake (o ID de teste no email ajuda a debugar se houver leak)
  const email = faker.internet.email({ provider: 'test.rubracash.com' }).toLowerCase();
  const password = faker.internet.password({ length: 16 });

  // 1. Cria usuário na API Admin
  const { data: adminData, error: adminError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (adminError || !adminData.user) {
    throw new Error(`Falha ao criar usuário de teste no Auth: ${adminError?.message}`);
  }

  // 2. Faz login com o cliente normal para obter uma sessão JWT real
  const client = envKey === 'user2' ? authClient2 : authClient1;
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.session) {
    // Se o login falhar, tenta deletar a conta recém criada para não deixar lixo
    await adminClient.auth.admin.deleteUser(adminData.user.id).catch(() => {});
    throw new Error(`Falha no login do usuário recém criado: ${authError?.message}`);
  }

  activeUsers[envKey] = {
    session: authData.session,
    userId: authData.session.user.id,
    accessToken: authData.session.access_token,
  };

  return activeUsers[envKey]!;
}

/**
 * Encerra a sessão dos clientes de autenticação de teste e deleta os usuários dinâmicos.
 */
export async function teardownAuth() {
  await authClient1.auth.signOut();
  await authClient2.auth.signOut();

  if (adminClient) {
    if (activeUsers.user1?.userId) {
      await adminClient.auth.admin.deleteUser(activeUsers.user1.userId).catch(() => {});
      activeUsers.user1 = null;
    }
    if (activeUsers.user2?.userId) {
      await adminClient.auth.admin.deleteUser(activeUsers.user2.userId).catch(() => {});
      activeUsers.user2 = null;
    }
  }
}

// ─── Request Builder ──────────────────────────────────────────────────────────

/**
 * Constrói um NextRequest autenticado para testes de Route Handlers.
 */
export function makeRequest(
  accessToken: string,
  url: string,
  options: {
    method?: string;
    body?: unknown;
  } = {}
): NextRequest {
  const { method = 'GET', body } = options;
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/**
 * Constrói um NextRequest SEM token (para testar rejeição de 401).
 */
export function makeUnauthRequest(
  url: string,
  options: { method?: string; body?: unknown } = {}
): NextRequest {
  const { method = 'GET', body } = options;
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ─── Data Fixtures (via Prisma) ───────────────────────────────────────────────

/**
 * Cria uma account de teste para o userId.
 * Aceita overrides parciais para personalizar campos.
 */
export async function createAccount(
  userId: string,
  overrides: Partial<{
    name: string;
    emoji: string;
    color: string;
    anchor_date: Date;
    anchor_balance: number;
    parent_account_id: string | null;
  }> = {}
) {
  return prisma.accounts.create({
    data: {
      user_id: userId,
      name: overrides.name ?? `Test Account ${Date.now()}`,
      emoji: overrides.emoji ?? '🏦',
      color: overrides.color ?? '#000000',
      anchor_date: overrides.anchor_date ?? new Date('2024-01-01'),
      anchor_balance: overrides.anchor_balance ?? 0,
      parent_account_id: overrides.parent_account_id ?? null,
    },
  });
}

/**
 * Cria uma transaction de teste para o userId.
 */
export async function createTransaction(
  userId: string,
  overrides: Partial<{
    title: string;
    amount: number;
    type: string;
    date: Date;
    category: string;
    account_id: string | null;
    counterpart_account_id: string | null;
  }> = {}
) {
  return prisma.transactions.create({
    data: {
      user_id: userId,
      title: overrides.title ?? `Test Transaction ${Date.now()}`,
      amount: overrides.amount ?? 100,
      type: overrides.type ?? 'expense',
      date: overrides.date ?? new Date('2024-06-15'),
      category: overrides.category ?? 'Outros',
      account_id: overrides.account_id ?? null,
      counterpart_account_id: overrides.counterpart_account_id ?? null,
    },
  });
}

/**
 * Cria uma nota de teste para o userId.
 */
export async function createNote(
  userId: string,
  overrides: Partial<{
    title: string;
    description: string;
  }> = {}
) {
  return prisma.notes.create({
    data: {
      user_id: userId,
      title: overrides.title ?? `Test Note ${Date.now()}`,
      description: overrides.description ?? 'Descrição de teste',
    },
  });
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

/**
 * Limpa todos os dados de teste de um usuário.
 * Mantém o usuário de auth — apenas remove os dados.
 * Ordem respeita Foreign Keys.
 */
export async function clearUserData(userId: string | undefined) {
  if (!userId) return;
  await prisma.transactions.deleteMany({ where: { user_id: userId } });
  await prisma.import_batches.deleteMany({ where: { user_id: userId } });
  await prisma.accounts.deleteMany({ where: { user_id: userId } });
  await prisma.custom_categories.deleteMany({ where: { user_id: userId } });
  await prisma.notes.deleteMany({ where: { user_id: userId } });
}


/**
 * Limpa dados de múltiplos usuários em sequência.
 */
export async function teardown(...userIds: string[]) {
  for (const userId of userIds) {
    if (userId) await clearUserData(userId);
  }
  await teardownAuth();
}

