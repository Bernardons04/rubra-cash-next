/**
 * transactions.api.test.ts
 *
 * Testes dos Route Handlers de /api/transactions.
 * Cobre: auth, Zod, happy paths, ownership, batch e transferências.
 */

import * as orchestrator from '../utils/orchestrator';
import { GET, POST } from '../../src/app/api/transactions/route';
import { PATCH, DELETE } from '../../src/app/api/transactions/[id]/route';
import { POST as BATCH_POST, DELETE as BATCH_DELETE } from '../../src/app/api/transactions/batch/route';

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

describe('GET /api/transactions - Autenticação', () => {
  it('deve retornar 401 se não houver token', async () => {
    const req = orchestrator.makeUnauthRequest('/api/transactions');
    const res = await GET(req, {});
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/transactions ────────────────────────────────────────────────────

describe('GET /api/transactions', () => {
  it('deve retornar apenas as transactions do usuário autenticado', async () => {
    await orchestrator.createTransaction(user1.userId, { title: 'Minha Tx' });
    await orchestrator.createTransaction(user2.userId, { title: 'Tx Alheia' });

    const req = orchestrator.makeRequest(user1.accessToken, '/api/transactions');
    const res = await GET(req, {});
    const body = await res.json();

    expect(body.transactions).toHaveLength(1);
    expect(body.transactions[0].title).toBe('Minha Tx');
  });
});

// ─── POST /api/transactions ───────────────────────────────────────────────────

describe('POST /api/transactions', () => {
  it('deve retornar 201 com DTO da transaction criada', async () => {
    const req = orchestrator.makeRequest(user1.accessToken, '/api/transactions', {
      method: 'POST',
      body: {
        title: 'Salário',
        amount: 5000,
        type: 'income',
        date: '2024-06-01',
        category: 'Salário',
      },
    });

    const res = await POST(req, {});
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.transaction.title).toBe('Salário');
    expect(body.transaction.amount).toBe(5000);
    expect(body.transaction).toHaveProperty('id');
  });

  it('deve retornar 400 se title estiver ausente (Zod)', async () => {
    const req = orchestrator.makeRequest(user1.accessToken, '/api/transactions', {
      method: 'POST',
      body: { amount: 100, type: 'expense', date: '2024-06-01', category: 'Outros' },
    });

    const res = await POST(req, {});
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('details');
  });

  it('deve retornar 400 se date for uma data inválida (2024-02-30)', async () => {
    const req = orchestrator.makeRequest(user1.accessToken, '/api/transactions', {
      method: 'POST',
      body: { title: 'Tx', amount: 100, type: 'expense', date: '2024-02-30', category: 'Outros' },
    });

    const res = await POST(req, {});
    expect(res.status).toBe(400);
  });

  it('deve retornar 400 se type for inválido', async () => {
    const req = orchestrator.makeRequest(user1.accessToken, '/api/transactions', {
      method: 'POST',
      body: { title: 'Tx', amount: 100, type: 'invalid_type', date: '2024-06-01', category: 'Outros' },
    });

    const res = await POST(req, {});
    expect(res.status).toBe(400);
  });

  it('deve retornar 400 ao usar accountId de outro usuário', async () => {
    const theirAcc = await orchestrator.createAccount(user2.userId);

    const req = orchestrator.makeRequest(user1.accessToken, '/api/transactions', {
      method: 'POST',
      body: {
        title: 'Hack',
        amount: 100,
        type: 'expense',
        date: '2024-06-01',
        category: 'Outros',
        accountId: theirAcc.id,
      },
    });

    const res = await POST(req, {});
    expect(res.status).toBe(400);
  });

  it('deve retornar 400 ao tentar self-transfer', async () => {
    const acc = await orchestrator.createAccount(user1.userId);

    const req = orchestrator.makeRequest(user1.accessToken, '/api/transactions', {
      method: 'POST',
      body: {
        title: 'Self',
        amount: 100,
        type: 'transfer',
        date: '2024-06-01',
        category: 'Outros',
        accountId: acc.id,
        counterpartAccountId: acc.id,
      },
    });

    const res = await POST(req, {});
    expect(res.status).toBe(400);
  });

  it('não deve vazar informações do Prisma em erros internos', async () => {
    const req = orchestrator.makeRequest(user1.accessToken, '/api/transactions', {
      method: 'POST',
      body: {
        title: 'Tx',
        amount: 100,
        type: 'expense',
        date: '2024-06-01',
        category: 'Outros',
        accountId: '00000000-0000-0000-0000-000000000000', // UUID inválido (inexistente)
      },
    });

    const res = await POST(req, {});
    // Deve retornar erro (400 por validação ou 404 por não encontrar), mas nunca 500 com stack trace
    expect(res.status).toBeLessThan(500);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    // Garantir que não há stack trace ou info interna vazada
    expect(JSON.stringify(body)).not.toContain('PrismaClient');
    expect(JSON.stringify(body)).not.toContain('at Object.');
  });
});

// ─── PATCH /api/transactions/[id] ────────────────────────────────────────────

describe('PATCH /api/transactions/[id]', () => {
  it('deve retornar 200 e o DTO atualizado', async () => {
    const tx = await orchestrator.createTransaction(user1.userId, { title: 'Antigo' });

    const req = orchestrator.makeRequest(user1.accessToken, `/api/transactions/${tx.id}`, {
      method: 'PATCH',
      body: { title: 'Atualizado' },
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: tx.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transaction.title).toBe('Atualizado');
  });

  it('deve retornar 404 ao tentar atualizar transaction de outro usuário', async () => {
    const theirTx = await orchestrator.createTransaction(user2.userId);

    const req = orchestrator.makeRequest(user1.accessToken, `/api/transactions/${theirTx.id}`, {
      method: 'PATCH',
      body: { title: 'Hack' },
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: theirTx.id }) });
    expect(res.status).toBe(404);
  });
});

// ─── DELETE /api/transactions/[id] ───────────────────────────────────────────

describe('DELETE /api/transactions/[id]', () => {
  it('deve retornar 204 ao deletar transaction própria', async () => {
    const tx = await orchestrator.createTransaction(user1.userId);

    const req = orchestrator.makeRequest(user1.accessToken, `/api/transactions/${tx.id}`, {
      method: 'DELETE',
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: tx.id }) });
    expect(res.status).toBe(204);
  });

  it('deve retornar 404 ao tentar deletar transaction de outro usuário', async () => {
    const theirTx = await orchestrator.createTransaction(user2.userId);

    const req = orchestrator.makeRequest(user1.accessToken, `/api/transactions/${theirTx.id}`, {
      method: 'DELETE',
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: theirTx.id }) });
    expect(res.status).toBe(404);
  });
});

// ─── POST /api/transactions/batch ────────────────────────────────────────────

describe('POST /api/transactions/batch', () => {
  it('deve retornar 201 ao importar um batch de transactions', async () => {
    const req = orchestrator.makeRequest(user1.accessToken, '/api/transactions/batch', {
      method: 'POST',
      body: {
        metadata: { name: 'extrato.pdf', type: 'pdf', raw_text: '' },
        transactions: [
          { title: 'Tx A', amount: 100, type: 'expense', date: '2024-06-01', category: 'Alimentação' },
          { title: 'Tx B', amount: 200, type: 'expense', date: '2024-06-02', category: 'Transporte' },
        ],
      },
    });

    const res = await BATCH_POST(req, {});
    expect(res.status).toBe(201);
  });

  it('deve retornar 400 se accountId no batch pertence a outro usuário', async () => {
    const theirAcc = await orchestrator.createAccount(user2.userId);

    const req = orchestrator.makeRequest(user1.accessToken, '/api/transactions/batch', {
      method: 'POST',
      body: {
        metadata: { name: 'hack.pdf', type: 'pdf', raw_text: '' },
        transactions: [
          { title: 'Hack Batch', amount: 100, type: 'expense', date: '2024-06-01', category: 'Outros', accountId: theirAcc.id },
        ],
      },
    });

    const res = await BATCH_POST(req, {});
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /api/transactions/batch ──────────────────────────────────────────

describe('DELETE /api/transactions/batch', () => {
  it('deve retornar 204 ao deletar batch de transactions próprias', async () => {
    const tx1 = await orchestrator.createTransaction(user1.userId);
    const tx2 = await orchestrator.createTransaction(user1.userId);

    const req = orchestrator.makeRequest(user1.accessToken, '/api/transactions/batch', {
      method: 'DELETE',
      body: { ids: [tx1.id, tx2.id] },
    });

    const res = await BATCH_DELETE(req, {});
    expect(res.status).toBe(204);
  });

  it('deve ignorar IDs de outros usuários na deleção em lote (sem erro)', async () => {
    const myTx = await orchestrator.createTransaction(user1.userId);
    const theirTx = await orchestrator.createTransaction(user2.userId);

    const req = orchestrator.makeRequest(user1.accessToken, '/api/transactions/batch', {
      method: 'DELETE',
      body: { ids: [myTx.id, theirTx.id] },
    });

    const res = await BATCH_DELETE(req, {});
    // Não deve falhar — apenas ignora os IDs que não pertencem ao usuário
    expect(res.status).toBe(204);
  });
});
