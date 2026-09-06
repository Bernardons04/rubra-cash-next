/**
 * account.service.test.ts
 *
 * Testes de integração do AccountService.
 * Usa Prisma diretamente contra o banco DEV.
 * Autenticação: Supabase Auth via orchestrator.
 */

import * as orchestrator from '../utils/orchestrator';
import {
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
} from '../../src/services/account.service';
import { NotFoundError, ValidationError } from '../../src/lib/errors';

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
  // Limpa dados antes de cada teste para garantir isolamento
  await orchestrator.clearUserData(user1.userId);
  await orchestrator.clearUserData(user2.userId);
});


describe('AccountService - listAccounts', () => {
  it('deve retornar lista vazia quando não há accounts', async () => {
    const accounts = await listAccounts(user1.userId);
    expect(accounts).toEqual([]);
  });

  it('deve retornar apenas as accounts do userId autenticado', async () => {
    // Cria uma conta para user1 e uma para user2
    await orchestrator.createAccount(user1.userId, { name: 'Conta User1' });
    await orchestrator.createAccount(user2.userId, { name: 'Conta User2' });

    const accounts = await listAccounts(user1.userId);
    expect(accounts).toHaveLength(1);
    expect(accounts[0].name).toBe('Conta User1');
  });
});

describe('AccountService - createAccount', () => {
  it('deve criar uma account com campos obrigatórios', async () => {
    const account = await createAccount(user1.userId, {
      name: 'Conta Corrente',
      emoji: '💰',
      color: '#FF5733',
      anchorDate: '2024-01-01',
      anchorBalance: 1000,
      parentAccountId: null,
    });

    expect(account.id).toBeDefined();
    expect(account.name).toBe('Conta Corrente');
    expect(account.emoji).toBe('💰');
    expect(account.anchorBalance).toBe(1000);
    expect(account.parentAccountId).toBeNull();
  });

  it('deve criar uma sub-account vinculada a uma parent válida do mesmo usuário', async () => {
    const parent = await orchestrator.createAccount(user1.userId, { name: 'Conta Pai' });
    const child = await createAccount(user1.userId, {
      name: 'Cofrinho',
      emoji: '🐷',
      color: '#FFA07A',
      anchorDate: '2024-01-01',
      anchorBalance: 0,
      parentAccountId: parent.id,
    });

    expect(child.parentAccountId).toBe(parent.id);
  });

  it('deve lançar ValidationError se parentAccountId pertence a outro usuário', async () => {
    const otherUserAccount = await orchestrator.createAccount(user2.userId);

    await expect(
      createAccount(user1.userId, {
        name: 'Conta Inválida',
        emoji: '🏦',
        color: '#000',
        anchorDate: '2024-01-01',
        anchorBalance: 0,
        parentAccountId: otherUserAccount.id, // ID do user2!
      })
    ).rejects.toThrow(ValidationError);
  });
});

describe('AccountService - updateAccount', () => {
  it('deve atualizar o nome de uma account do próprio usuário', async () => {
    const account = await orchestrator.createAccount(user1.userId, { name: 'Nome Antigo' });
    const updated = await updateAccount(user1.userId, account.id, { name: 'Nome Novo' });
    expect(updated.name).toBe('Nome Novo');
  });

  it('deve lançar NotFoundError ao tentar atualizar account de outro usuário', async () => {
    const otherAccount = await orchestrator.createAccount(user2.userId);

    await expect(
      updateAccount(user1.userId, otherAccount.id, { name: 'Hack' })
    ).rejects.toThrow(NotFoundError);
  });

  it('deve lançar NotFoundError ao tentar atualizar account inexistente', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    await expect(
      updateAccount(user1.userId, fakeId, { name: 'Hack' })
    ).rejects.toThrow(NotFoundError);
  });

  it('deve lançar ValidationError se parentAccountId é o próprio ID (auto-referência)', async () => {
    const account = await orchestrator.createAccount(user1.userId);
    await expect(
      updateAccount(user1.userId, account.id, { parentAccountId: account.id })
    ).rejects.toThrow(ValidationError);
  });

  it('deve lançar ValidationError se parentAccountId pertence a outro usuário', async () => {
    const myAccount = await orchestrator.createAccount(user1.userId);
    const theirAccount = await orchestrator.createAccount(user2.userId);

    await expect(
      updateAccount(user1.userId, myAccount.id, { parentAccountId: theirAccount.id })
    ).rejects.toThrow(ValidationError);
  });
});

describe('AccountService - deleteAccount', () => {
  it('deve deletar uma account do próprio usuário', async () => {
    const account = await orchestrator.createAccount(user1.userId);
    await deleteAccount(user1.userId, account.id);

    const remaining = await listAccounts(user1.userId);
    expect(remaining.find(a => a.id === account.id)).toBeUndefined();
  });

  it('deve lançar NotFoundError ao tentar deletar account de outro usuário', async () => {
    const otherAccount = await orchestrator.createAccount(user2.userId);

    await expect(
      deleteAccount(user1.userId, otherAccount.id)
    ).rejects.toThrow(NotFoundError);
  });

  it('deve lançar NotFoundError ao tentar deletar account inexistente', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    await expect(
      deleteAccount(user1.userId, fakeId)
    ).rejects.toThrow(NotFoundError);
  });
});
