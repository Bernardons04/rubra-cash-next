/**
 * transaction.service.test.ts
 *
 * Testes de integração do TransactionService.
 * Cobre CRUD, validações de ownership, self-transfer, batch import e atomicidade.
 */

import * as orchestrator from '../utils/orchestrator';
import { prisma } from '../../src/lib/prisma';
import {
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  deleteTransactionsBatch,
  saveTransactionsBatch,
} from '../../src/services/transaction.service';
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
  await orchestrator.clearUserData(user1.userId);
  await orchestrator.clearUserData(user2.userId);
});


describe('TransactionService - listTransactions', () => {
  it('deve retornar apenas as transactions do userId autenticado', async () => {
    await orchestrator.createTransaction(user1.userId, { title: 'Tx User1' });
    await orchestrator.createTransaction(user2.userId, { title: 'Tx User2' });

    const txs = await listTransactions(user1.userId);
    expect(txs).toHaveLength(1);
    expect(txs[0].title).toBe('Tx User1');
  });
});

describe('TransactionService - createTransaction', () => {
  it('deve criar uma transaction income simples', async () => {
    const tx = await createTransaction(user1.userId, {
      title: 'Salário',
      amount: 5000,
      type: 'income',
      date: '2024-06-01',
      category: 'Salário',
    });

    expect(tx.id).toBeDefined();
    expect(tx.title).toBe('Salário');
    expect(tx.amount).toBe(5000);
    expect(tx.type).toBe('income');
  });

  it('deve criar uma transferência entre duas contas do mesmo usuário', async () => {
    const accA = await orchestrator.createAccount(user1.userId, { name: 'Conta A' });
    const accB = await orchestrator.createAccount(user1.userId, { name: 'Conta B' });

    const tx = await createTransaction(user1.userId, {
      title: 'Transferência A→B',
      amount: 500,
      type: 'transfer',
      date: '2024-06-15',
      category: 'Outros',
      direction: 'out',
      accountId: accA.id,
      counterpartAccountId: accB.id,
    });

    expect(tx.type).toBe('transfer');
    expect(tx.accountId).toBe(accA.id);
    expect(tx.counterpartAccountId).toBe(accB.id);
  });

  it('deve lançar ValidationError ao tentar self-transfer (mesma conta)', async () => {
    const acc = await orchestrator.createAccount(user1.userId);

    await expect(
      createTransaction(user1.userId, {
        title: 'Self-Transfer',
        amount: 100,
        type: 'transfer',
        date: '2024-06-15',
        category: 'Outros',
        accountId: acc.id,
        counterpartAccountId: acc.id, // mesma conta!
      })
    ).rejects.toThrow(ValidationError);
  });

  it('deve lançar ValidationError ao usar accountId de outro usuário', async () => {
    const theirAcc = await orchestrator.createAccount(user2.userId);

    await expect(
      createTransaction(user1.userId, {
        title: 'Hack Account',
        amount: 100,
        type: 'expense',
        date: '2024-06-15',
        category: 'Outros',
        accountId: theirAcc.id,
      })
    ).rejects.toThrow(ValidationError);
  });

  it('deve lançar ValidationError ao usar counterpartAccountId de outro usuário', async () => {
    const myAcc = await orchestrator.createAccount(user1.userId);
    const theirAcc = await orchestrator.createAccount(user2.userId);

    await expect(
      createTransaction(user1.userId, {
        title: 'Hack Counterpart',
        amount: 100,
        type: 'transfer',
        date: '2024-06-15',
        category: 'Outros',
        accountId: myAcc.id,
        counterpartAccountId: theirAcc.id, // ID do user2!
      })
    ).rejects.toThrow(ValidationError);
  });
});

describe('TransactionService - updateTransaction', () => {
  it('deve atualizar o título de uma transaction do próprio usuário', async () => {
    const tx = await orchestrator.createTransaction(user1.userId, { title: 'Título Antigo' });
    const updated = await updateTransaction(user1.userId, tx.id, { title: 'Título Novo' });
    expect(updated.title).toBe('Título Novo');
  });

  it('deve lançar NotFoundError ao tentar atualizar transaction de outro usuário', async () => {
    const theirTx = await orchestrator.createTransaction(user2.userId);
    await expect(
      updateTransaction(user1.userId, theirTx.id, { title: 'Hack' })
    ).rejects.toThrow(NotFoundError);
  });
});

describe('TransactionService - deleteTransaction', () => {
  it('deve deletar uma transaction do próprio usuário', async () => {
    const tx = await orchestrator.createTransaction(user1.userId);
    await deleteTransaction(user1.userId, tx.id);
    const remaining = await listTransactions(user1.userId);
    expect(remaining.find(t => t.id === tx.id)).toBeUndefined();
  });

  it('deve lançar NotFoundError ao tentar deletar transaction de outro usuário', async () => {
    const theirTx = await orchestrator.createTransaction(user2.userId);
    await expect(
      deleteTransaction(user1.userId, theirTx.id)
    ).rejects.toThrow(NotFoundError);
  });
});

describe('TransactionService - deleteTransactionsBatch', () => {
  it('deve deletar apenas as transactions que pertencem ao usuário', async () => {
    const myTx = await orchestrator.createTransaction(user1.userId, { title: 'Minha Tx' });
    const theirTx = await orchestrator.createTransaction(user2.userId, { title: 'Tx Deles' });

    // Envia ambos os IDs — apenas myTx deve ser deletada
    await deleteTransactionsBatch(user1.userId, [myTx.id, theirTx.id]);

    const myRemaining = await listTransactions(user1.userId);
    const theirRemaining = await listTransactions(user2.userId);

    expect(myRemaining.find(t => t.id === myTx.id)).toBeUndefined();
    expect(theirRemaining.find(t => t.id === theirTx.id)).toBeDefined(); // Permaneceu
  });
});

describe('TransactionService - saveTransactionsBatch (atomicidade)', () => {
  it('deve criar o import_batch e as transactions atomicamente', async () => {
    const acc = await orchestrator.createAccount(user1.userId);

    await saveTransactionsBatch(user1.userId, {
      metadata: { name: 'extrato.pdf', type: 'pdf', raw_text: '' },
      transactions: [
        {
          title: 'Compra A',
          amount: 100,
          type: 'expense',
          date: '2024-06-01',
          category: 'Alimentação',
          accountId: acc.id,
        },
        {
          title: 'Compra B',
          amount: 200,
          type: 'expense',
          date: '2024-06-02',
          category: 'Transporte',
          accountId: null,
        },
      ],
    });

    const txs = await listTransactions(user1.userId);
    expect(txs).toHaveLength(2);
    expect(txs.map(t => t.title)).toEqual(expect.arrayContaining(['Compra A', 'Compra B']));

    // Verifica que o import_batch foi criado
    const batches = await prisma.import_batches.findMany({ where: { user_id: user1.userId } });
    expect(batches).toHaveLength(1);
    expect(batches[0].transaction_count).toBe(2);
  });

  it('deve lançar ValidationError se accountId no batch pertence a outro usuário', async () => {
    const theirAcc = await orchestrator.createAccount(user2.userId);

    await expect(
      saveTransactionsBatch(user1.userId, {
        metadata: { name: 'hack.pdf', type: 'pdf', raw_text: '' },
        transactions: [
          {
            title: 'Hack batch',
            amount: 100,
            type: 'expense',
            date: '2024-06-01',
            category: 'Outros',
            accountId: theirAcc.id, // ID do user2!
          },
        ],
      })
    ).rejects.toThrow(ValidationError);

    // Garante rollback: nenhuma transaction foi criada
    const txs = await listTransactions(user1.userId);
    expect(txs).toHaveLength(0);
  });
});
