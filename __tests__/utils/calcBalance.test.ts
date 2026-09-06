import { calcBalance } from '../../src/lib/utils';
import { Account, Transaction } from '../../src/context/DataContext';

describe('calcBalance', () => {
  it('deve retornar o saldo âncora (anchorBalance) quando não houver nenhuma transação', () => {
    // Arrange (Preparação)
    const accountId = 'acc-123';
    const mockAccount: Account = {
      id: accountId,
      name: 'Conta Corrente',
      emoji: '🏦',
      color: '#000000',
      anchorDate: '2023-01-01',
      anchorBalance: 1050.75,
      parentAccountId: null,
    };
    const mockTransactions: Transaction[] = [];

    // Act (Ação)
    const result = calcBalance(accountId, mockAccount, mockTransactions);

    // Assert (Verificação)
    expect(result).toBe(1050.75);
  });
});
