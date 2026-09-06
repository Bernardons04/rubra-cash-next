/**
 * category.service.test.ts
 *
 * Testes de integração do CategoryService.
 * Foco em atomicidade do replace-all e isolamento por userId.
 */

import * as orchestrator from '../utils/orchestrator';
import { prisma } from '../../src/lib/prisma';
import { listCategories, saveCategories } from '../../src/services/category.service';

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


describe('CategoryService - listCategories', () => {
  it('deve retornar mapa vazio quando não há categorias', async () => {
    const cats = await listCategories(user1.userId);
    expect(cats).toEqual({});
  });

  it('deve retornar apenas as categorias do userId autenticado', async () => {
    await saveCategories(user1.userId, { Alimentação: ['Mercado', 'Restaurante'] });
    await saveCategories(user2.userId, { Transporte: ['Uber'] });

    const cats = await listCategories(user1.userId);
    expect(Object.keys(cats)).toEqual(['Alimentação']);
    expect(cats['Alimentação']).toEqual(['Mercado', 'Restaurante']);
  });
});

describe('CategoryService - saveCategories', () => {
  it('deve criar categorias e retornar o mapa salvo', async () => {
    const input = {
      Alimentação: ['Mercado', 'Restaurante'],
      Transporte: ['Combustível', 'Uber'],
    };
    const result = await saveCategories(user1.userId, input);
    expect(result).toEqual(input);
  });

  it('deve substituir todas as categorias anteriores (replace-all)', async () => {
    // Salva categorias iniciais
    await saveCategories(user1.userId, { Alimentação: ['Mercado'] });

    // Salva novamente com conjunto diferente
    await saveCategories(user1.userId, { Lazer: ['Cinema', 'Parque'] });

    const cats = await listCategories(user1.userId);
    expect(Object.keys(cats)).not.toContain('Alimentação'); // removida
    expect(cats['Lazer']).toEqual(['Cinema', 'Parque']);    // nova
  });

  it('deve ser atômico: não deve deixar dados parciais se falhar', async () => {
    // Pré-condição: user1 tem uma categoria
    await saveCategories(user1.userId, { Existente: ['Sub1'] });

    // Forçamos falha mockando o prisma.$transaction
    // Verificamos que os dados antigos continuam intactos
    const prismaTransactionSpy = jest
      .spyOn(prisma, '$transaction')
      .mockRejectedValueOnce(new Error('DB falhou'));

    await expect(
      saveCategories(user1.userId, { Nova: ['SubNova'] })
    ).rejects.toThrow('DB falhou');

    prismaTransactionSpy.mockRestore();

    // Após falha, a categoria anterior NÃO deve ter sido deletada
    const cats = await listCategories(user1.userId);
    expect(cats['Existente']).toEqual(['Sub1']);
  });

  it('não deve alterar categorias de outro usuário durante o replace-all', async () => {
    await saveCategories(user1.userId, { Alimentação: ['Mercado'] });
    await saveCategories(user2.userId, { Saúde: ['Farmácia'] });

    // User1 atualiza suas categorias
    await saveCategories(user1.userId, { Lazer: ['Cinema'] });

    // Categorias do user2 devem permanecer intactas
    const user2Cats = await listCategories(user2.userId);
    expect(user2Cats['Saúde']).toEqual(['Farmácia']);
  });
});
