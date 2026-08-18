import { Account, Transaction } from '@/context/DataContext';

export const PREDEFINED_CATEGORIES: Record<string, string[]> = {
  'Moradia': ['Aluguel', 'Condomínio', 'Energia', 'Água', 'Internet', 'Gás', 'Manutenção', 'Móveis e decoração'],
  'Alimentação': ['Restaurante', 'Delivery', 'Mercado', 'Padaria', 'Café'],
  'Transporte': ['Aplicativos de mobilidade', 'Estacionamento e pedágio', 'Manutenção do carro', 'Transporte público'],
  'Saúde': ['Farmácia', 'Consulta', 'Dentista', 'Oftalmologista', 'Exame', 'Plano de saúde'],
  'Fitness': ['Academia', 'Personal Trainer', 'Yoga', 'Pilates'],
  'Beleza': ['Cabelo', 'Unhas', 'Esteticista', 'Barbearia', 'Produtos'],
  'Educação': ['Curso', 'Livros', 'Faculdade', 'Idiomas', 'Certificação'],
  'Trabalho': ['Ferramentas', 'Software', 'Treinamento', 'Associação'],
  'Pets': ['Veterinário', 'Ração', 'Brinquedos', 'Grooming'],
  'Lazer': ['Cinema', 'Shows', 'Viagem', 'Parques', 'Bares', 'Streaming', 'Jogos'],
  'Assinaturas': ['Jornal', 'Revista', 'Aplicativos'],
  'Seguros': ['Saúde', 'Carro', 'Residência', 'Vida'],
  'Impostos': ['IR', 'INSS', 'Emplacamento', 'Multas'],
  'Investimentos': ['Ações', 'Cripto', 'Renda Fixa', 'Fundos', 'Dividendos', 'Resgate'],
  'Salário': ['CLT', 'Contrato', 'Comissão', 'Freelance'],
  'Compras': ['Arte e música', 'Coisas pra casa', 'Eletrônicos', 'Esporte e equipamentos', 'Eventos e atividades', 'Festas e encontros', 'Presentes', 'Roupas e acessórios'],
  'Celular': ['Plano', 'Recarga', 'Internet móvel'],
  'Outros': ['Reembolso', 'Saque', 'Transferência', 'Diversos']
};

export const ACCOUNT_COLOR_PRESETS = ['#4d9fff', '#00e5b0', '#f5a623', '#ff4d6d', '#a855f7', '#75d934', '#f472b6', '#fb923c'];

export function calcBalance(accountId: string, account: Account, transactions: Transaction[]): number {
  const base = parseFloat(String(account.anchorBalance)) || 0;
  let delta = 0;
  transactions.forEach(tx => {
    if (!tx.date || tx.date <= account.anchorDate) return;
    if (tx.accountId !== accountId) return;
    if (tx.type === 'income') delta += tx.amount;
    else if (tx.type === 'expense') delta -= tx.amount;
    else if (tx.type === 'transfer') {
      if (tx.direction === 'out') delta -= tx.amount;
      else if (tx.direction === 'in') delta += tx.amount;
    }
  });
  return base + delta;
}

export function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

export function formatDate(d: string): string {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  const [y, m, day] = parts;
  return `${day}/${m}/${y}`;
}

export function parseDate(d: string): Date | null {
  if (!d) return null;
  const p = new Date(d + 'T00:00:00');
  return isNaN(p.getTime()) ? null : p;
}

export function getMonthKey(d: string): string {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length < 2) return '';
  const [y, m] = parts;
  return `${y}-${m}`;
}

export function getMonthLabel(k: string): string {
  if (!k) return '';
  const parts = k.split('-');
  if (parts.length < 2) return k;
  const [y, m] = parts;
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

export function getDayGroupLabel(d: string): string {
  const date = parseDate(d);
  if (!date) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  if (target.getTime() === today.getTime()) return 'Hoje';
  if (target.getTime() === yesterday.getTime()) return 'Ontem';

  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' });
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${day}/${month}/${date.getFullYear()}`;
}

export function categoryEmoji(cat: string): string {
  const map: Record<string, string> = {
    'Moradia': '🏠', 'Alimentação': '🍽️', 'Transporte': '🚗', 'Saúde': '💊', 'Fitness': '🏋️',
    'Beleza': '💅', 'Educação': '📚', 'Trabalho': '💼', 'Pets': '🐶', 'Lazer': '🎉',
    'Assinaturas': '📺', 'Seguros': '🛡️', 'Impostos': '🧾', 'Investimentos': '📈',
    'Salário': '💰', 'Compras': '🛍️', 'Celular': '📱', 'Outros': '📦'
  };
  return map[cat] || '💳';
}

export function methodEmoji(m: string): string {
  const map: Record<string, string> = {
    pix: '💬', credit_card: '💳', debit_card: '🏧', boleto: '📜', transfer: '🔄', other: '📦'
  };
  return map[m] || '💳';
}

export function methodLabel(m: string): string {
  const map: Record<string, string> = {
    pix: 'PIX', credit_card: 'Crédito', debit_card: 'Débito', boleto: 'Boleto', transfer: 'Transferência', other: 'Outro'
  };
  return map[m] || m;
}

export function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): (...args: Parameters<T>) => void {
  let t: NodeJS.Timeout;
  return (...a: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

export function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
