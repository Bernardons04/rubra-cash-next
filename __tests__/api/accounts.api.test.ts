/**
 * accounts.api.test.ts
 *
 * Testes dos Route Handlers de /api/accounts.
 * Usa tokens JWT reais via orchestrator.
 * Cobre: auth, Zod, happy paths, ownership e erros.
 */

import * as orchestrator from '../utils/orchestrator';
import { GET, POST } from '../../src/app/api/accounts/route';
import { PATCH, DELETE } from '../../src/app/api/accounts/[id]/route';


let user1: orchestrator.TestUser;
let user2: orchestrator.TestUser;

beforeAll(async () => {
  user1 = await orchestrator.setupUser('user1');
  user2 = await orchestrator.setupUser('user2');
}, 30000);

afterAll(async () => {
  await orchestrator.clearUserData(user1?.userId);
  await orchestrator.clearUserData(user2?.userId);
  await orchestrator.teardownAuth();
}, 30000);

beforeEach(async () => {
  // Limpa dados entre testes mas mantém os usuários (FK constraint)
  await orchestrator.clearUserData(user1.userId);
  await orchestrator.clearUserData(user2.userId);
});


// ─── Autenticação ─────────────────────────────────────────────────────────────

describe('GET /api/accounts - Autenticação', () => {
  it('deve retornar 401 se não houver token', async () => {
    const req = orchestrator.makeUnauthRequest('/api/accounts');
    const res = await GET(req, {});
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('deve retornar 401 se o token for inválido', async () => {
    const req = orchestrator.makeRequest('token-invalido-aqui', '/api/accounts');
    const res = await GET(req, {});
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/accounts ────────────────────────────────────────────────────────

describe('GET /api/accounts', () => {
  it('deve retornar 200 com lista vazia quando não há accounts', async () => {
    const req = orchestrator.makeRequest(user1.accessToken, '/api/accounts');
    const res = await GET(req, {});
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('accounts');
    expect(body.accounts).toEqual([]);
  });

  it('deve retornar apenas as accounts do usuário autenticado', async () => {
    await orchestrator.createAccount(user1.userId, { name: 'Minha Conta' });
    await orchestrator.createAccount(user2.userId, { name: 'Conta Alheia' });

    const req = orchestrator.makeRequest(user1.accessToken, '/api/accounts');
    const res = await GET(req, {});
    const body = await res.json();

    expect(body.accounts).toHaveLength(1);
    expect(body.accounts[0].name).toBe('Minha Conta');
  });
});

// ─── POST /api/accounts ───────────────────────────────────────────────────────

describe('POST /api/accounts', () => {
  it('deve retornar 201 e o DTO da account criada', async () => {
    const req = orchestrator.makeRequest(user1.accessToken, '/api/accounts', {
      method: 'POST',
      body: {
        name: 'Conta Nova',
        emoji: '💰',
        color: '#FF5733',
        anchorDate: '2024-01-01',
        anchorBalance: 500,
      },
    });

    const res = await POST(req, {});
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.account.name).toBe('Conta Nova');
    expect(body.account.anchorBalance).toBe(500);
    expect(body.account).toHaveProperty('id');
    expect(body.account).not.toHaveProperty('user_id'); // userId não deve vazar
  });

  it('deve retornar 400 se o nome estiver ausente (Zod)', async () => {
    const req = orchestrator.makeRequest(user1.accessToken, '/api/accounts', {
      method: 'POST',
      body: { emoji: '💰' }, // name obrigatório ausente
    });

    const res = await POST(req, {});
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('details');
  });

  it('deve retornar 400 se anchorDate for uma data inválida (ex: 2024-02-30)', async () => {
    const req = orchestrator.makeRequest(user1.accessToken, '/api/accounts', {
      method: 'POST',
      body: {
        name: 'Conta com Data Ruim',
        anchorDate: '2024-02-30', // Dia 30 de fevereiro não existe
        anchorBalance: 0,
      },
    });

    const res = await POST(req, {});
    expect(res.status).toBe(400);
  });

  it('deve retornar 400 se anchorBalance for um tipo inválido (ex: string)', async () => {
    const req = orchestrator.makeRequest(user1.accessToken, '/api/accounts', {
      method: 'POST',
      body: {
        name: 'Conta Inválida',
        anchorBalance: 'not-a-number',
      },
    });

    const res = await POST(req, {});
    expect(res.status).toBe(400);
  });


  it('não deve aceitar user_id no body (deve ignorar)', async () => {
    const fakeUserId = user2.userId;
    const req = orchestrator.makeRequest(user1.accessToken, '/api/accounts', {
      method: 'POST',
      body: {
        name: 'Conta Forjada',
        anchorBalance: 0,
        user_id: fakeUserId, // Tentativa de injetar outro userId
      },
    });

    const res = await POST(req, {});
    expect(res.status).toBe(201);
    const body = await res.json();

    // Verificar buscando no banco diretamente
    const { prisma: db } = await import('../../src/lib/prisma');
    const created = await db.accounts.findFirst({
      where: { id: body.account.id },
    });
    expect(created?.user_id).toBe(user1.userId);
    expect(created?.user_id).not.toBe(fakeUserId);

  });
});

// ─── PATCH /api/accounts/[id] ─────────────────────────────────────────────────

describe('PATCH /api/accounts/[id]', () => {
  it('deve retornar 200 e o DTO atualizado', async () => {
    const account = await orchestrator.createAccount(user1.userId, { name: 'Nome Antigo' });

    const req = orchestrator.makeRequest(user1.accessToken, `/api/accounts/${account.id}`, {
      method: 'PATCH',
      body: { name: 'Nome Novo' },
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: account.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.account.name).toBe('Nome Novo');
  });

  it('deve retornar 404 ao tentar atualizar account de outro usuário (não revela existência)', async () => {
    const theirAccount = await orchestrator.createAccount(user2.userId);

    const req = orchestrator.makeRequest(user1.accessToken, `/api/accounts/${theirAccount.id}`, {
      method: 'PATCH',
      body: { name: 'Hack' },
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: theirAccount.id }) });
    expect(res.status).toBe(404); // Não 403 — não revela existência
  });

  it('deve retornar 400 se parentAccountId for o próprio ID (auto-referência)', async () => {
    const account = await orchestrator.createAccount(user1.userId);

    const req = orchestrator.makeRequest(user1.accessToken, `/api/accounts/${account.id}`, {
      method: 'PATCH',
      body: { parentAccountId: account.id },
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: account.id }) });
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /api/accounts/[id] ────────────────────────────────────────────────

describe('DELETE /api/accounts/[id]', () => {
  it('deve retornar 204 ao deletar account do próprio usuário', async () => {
    const account = await orchestrator.createAccount(user1.userId);

    const req = orchestrator.makeRequest(user1.accessToken, `/api/accounts/${account.id}`, {
      method: 'DELETE',
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: account.id }) });
    expect(res.status).toBe(204);
  });

  it('deve retornar 404 ao tentar deletar account de outro usuário', async () => {
    const theirAccount = await orchestrator.createAccount(user2.userId);

    const req = orchestrator.makeRequest(user1.accessToken, `/api/accounts/${theirAccount.id}`, {
      method: 'DELETE',
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: theirAccount.id }) });
    expect(res.status).toBe(404);
  });
});
