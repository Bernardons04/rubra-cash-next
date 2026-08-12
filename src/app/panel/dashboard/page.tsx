'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useUI } from '@/context/UIContext';
import { useData } from '@/context/DataContext';
import { formatBRL, getMonthKey, getMonthLabel, categoryEmoji, PREDEFINED_CATEGORIES } from '@/lib/utils';
import type { Chart as ChartType } from 'chart.js';

export default function DashboardPage() {
    const { theme } = useUI();
    const { transactions, accounts, customCategories, loadingData } = useData();

    const chartIncVsExpRef = useRef<HTMLCanvasElement>(null);
    const chartExpCatRef = useRef<HTMLCanvasElement>(null);
    const chartTimelineRef = useRef<HTMLCanvasElement>(null);

    const chartsRef = useRef<Record<string, ChartType>>({});

    const [filterAccount, setFilterAccount] = useLocalStorage('rubra-filter-account', '');
    const [filterMonth, setFilterMonth] = useLocalStorage('rubra-filter-month', '');
    const [filterCategory, setFilterCategory] = useLocalStorage('rubra-filter-category', '');
    const [filterType, setFilterType] = useLocalStorage('rubra-filter-type', '');

    const isDark = theme === 'dark';

    const allCategories = useMemo(() => {
        const pre = Object.keys(PREDEFINED_CATEGORIES);
        const cus = Object.keys(customCategories || {});
        return [...new Set([...pre, ...cus])].sort();
    }, [customCategories]);

    const availableMonths = useMemo(() => {
        const s = new Set<string>();
        transactions.forEach(t => {
            if (t.date) {
                const p = t.date.split('-');
                if (p.length >= 2) s.add(`${p[0]}-${p[1]}`);
            }
        });
        return Array.from(s).sort().reverse();
    }, [transactions]);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            if (filterAccount && filterAccount !== '__none__' && t.accountId !== filterAccount) return false;
            if (filterAccount === '__none__' && t.accountId) return false;
            if (filterMonth && getMonthKey(t.date) !== filterMonth) return false;
            if (filterCategory && t.category !== filterCategory) return false;
            if (filterType && t.type !== filterType) return false;
            return true;
        });
    }, [transactions, filterAccount, filterMonth, filterCategory, filterType]);

    const totalIncome = useMemo(() => filteredTransactions.filter(t => t.type === 'income' || (t.type === 'transfer' && t.direction === 'in')).reduce((s, t) => s + t.amount, 0), [filteredTransactions]);
    const totalExpense = useMemo(() => filteredTransactions.filter(t => t.type === 'expense' || (t.type === 'transfer' && t.direction === 'out')).reduce((s, t) => s + t.amount, 0), [filteredTransactions]);
    const totalBalance = useMemo(() => totalIncome - totalExpense, [totalIncome, totalExpense]);
    const hasExpenses = useMemo(() => filteredTransactions.some(t => t.type === 'expense'), [filteredTransactions]);

    const calcBalance = (accountId: string) => {
        const acc = accounts.find(a => a.id === accountId);
        if (!acc) return 0;
        const anchor = acc.anchorDate;
        const base = parseFloat(String(acc.anchorBalance)) || 0;
        let delta = 0;
        transactions.forEach(tx => {
            if (!tx.date || tx.date <= anchor) return;
            if (tx.accountId !== accountId) return;
            if (tx.type === 'income') delta += tx.amount;
            else if (tx.type === 'expense') delta -= tx.amount;
            else if (tx.type === 'transfer') {
                if (tx.direction === 'in') delta += tx.amount;
                if (tx.direction === 'out') delta -= tx.amount;
            }
        });
        return base + delta;
    };

    const getChartDefaults = () => ({
        color: isDark ? '#A3A3A3' : '#525252',
        gridColor: isDark ? '#262626' : '#E5E5E5',
        bgColor: isDark ? '#141414' : '#ffffff',
    });

    const destroyChart = (key: string) => {
        if (chartsRef.current[key]) {
            chartsRef.current[key].destroy();
            delete chartsRef.current[key];
        }
    };

    const renderCharts = async () => {
        const { Chart, registerables } = await import('chart.js');
        Chart.register(...registerables);

        const def = getChartDefaults();
        const COLORS = ['#00e5b0', '#ff4d6d', '#f5a623', '#4d9fff', '#a855f7', '#f472b6', '#34d399', '#fb923c', '#60a5fa', '#c084fc'];

        // Expenses by Category (Doughnut)
        destroyChart('expCat');
        const expCatCtx = chartExpCatRef.current;
        if (expCatCtx) {
            const byC: Record<string, number> = {};
            filteredTransactions.filter(t => t.type === 'expense').forEach(t => {
                const c = t.category || 'Outros';
                byC[c] = (byC[c] || 0) + t.amount;
            });
            const labels = Object.keys(byC).sort((a, b) => byC[b] - byC[a]);
            const values = labels.map(l => byC[l]);
            if (labels.length) {
                chartsRef.current.expCat = new Chart(expCatCtx, {
                    type: 'doughnut',
                    data: {
                        labels,
                        datasets: [{ data: values, backgroundColor: COLORS.slice(0, labels.length), borderWidth: 2, borderColor: def.bgColor }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom', labels: { color: def.color, boxWidth: 12, font: { size: 11 }, padding: 15 } },
                            tooltip: { callbacks: { label: (c) => ` ${c.label}: ${formatBRL(c.parsed as number)}` } },
                        },
                        cutout: '65%',
                    },
                });
            }
        }

        // Top Expenses (Horizontal Bar)
        destroyChart('timeline');
        const timelineCtx = chartTimelineRef.current;
        if (timelineCtx) {
            const byTitle: Record<string, number> = {};
            filteredTransactions.filter(t => t.type === 'expense').forEach(t => {
                const k = t.title || 'Sem título';
                byTitle[k] = (byTitle[k] || 0) + t.amount;
            });
            const sorted = Object.entries(byTitle).sort((a, b) => b[1] - a[1]).slice(0, 7);
            const labels = sorted.map(([t]) => t);
            const values = sorted.map(([, v]) => v);
            if (labels.length) {
                chartsRef.current.timeline = new Chart(timelineCtx, {
                    type: 'bar',
                    data: {
                        labels,
                        datasets: [{ label: 'Valor', data: values, backgroundColor: '#f5a62340', borderColor: '#f5a623', borderWidth: 2, borderRadius: 6 }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false, indexAxis: 'y' as const,
                        plugins: {
                            legend: { display: false },
                            tooltip: { callbacks: { label: (c) => ` ${formatBRL(c.parsed.x as number)}` } },
                        },
                        scales: {
                            x: { ticks: { color: def.color, font: { size: 10 }, callback: (v) => `R$ ${(Number(v as number) / 1000).toFixed(1)}k` }, grid: { color: def.gridColor } },
                            y: { ticks: { color: def.color, font: { size: 11 } }, grid: { color: 'transparent' } },
                        },
                    },
                });
            }
        }

        // Income vs Expense (Bar)
        destroyChart('incVsExp');
        const incVsExpCtx = chartIncVsExpRef.current;
        if (incVsExpCtx) {
            const months = [...new Set(filteredTransactions.map(t => getMonthKey(t.date)))].sort().slice(-6);
            const inc = months.map(m => filteredTransactions.filter(t => t.type === 'income' && getMonthKey(t.date) === m).reduce((s, t) => s + t.amount, 0));
            const exp = months.map(m => filteredTransactions.filter(t => t.type === 'expense' && getMonthKey(t.date) === m).reduce((s, t) => s + t.amount, 0));
            chartsRef.current.incVsExp = new Chart(incVsExpCtx, {
                type: 'bar',
                data: {
                    labels: months.map(m => getMonthLabel(m)),
                    datasets: [
                        { label: 'Receitas', data: inc, backgroundColor: '#75d9341f', borderColor: '#6cce2a', borderWidth: 2, borderRadius: 6 },
                        { label: 'Despesas', data: exp, backgroundColor: '#ff4d6d22', borderColor: '#ff4d6d', borderWidth: 2, borderRadius: 6 },
                    ],
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: def.color, font: { size: 11 } } },
                        tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${formatBRL(c.parsed.y as number)}` } },
                    },
                    scales: {
                        x: { ticks: { color: def.color, font: { size: 10 } }, grid: { color: def.gridColor } },
                        y: { ticks: { color: def.color, font: { size: 10 }, callback: (v) => `R$ ${(Number(v as number) / 1000).toFixed(0)}k` }, grid: { color: def.gridColor } },
                    },
                },
            });
        }
    };

    useEffect(() => {
        renderCharts();
        return () => {
            Object.keys(chartsRef.current).forEach(k => destroyChart(k));
        };
    }, [filteredTransactions, theme]);

    const cardBase = `rounded-2xl border md:p-5 p-3 bg-[var(--card)] border-[var(--border)]`;
    const selectBase = `rounded-xl border px-3 py-2 text-sm outline-none transition-all cursor-pointer
    bg-[var(--surface)] border-[var(--border)] text-[var(--text)] focus:border-[var(--border-soft)]`;

    if (loadingData) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-t-[#a84551]" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <select id="filter-account" className={selectBase} value={filterAccount} onChange={e => setFilterAccount(e.target.value)}>
                    <option value="">Todas as contas</option>
                    <option value="__none__">Sem conta</option>
                    {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.emoji || '🏦'} {a.name}</option>
                    ))}
                </select>

                <select id="filter-month" className={selectBase} value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
                    <option value="">Todos os meses</option>
                    {availableMonths.map(m => (
                        <option key={m} value={m}>{getMonthLabel(m)}</option>
                    ))}
                </select>

                <select id="filter-category" className={selectBase} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                    <option value="">Todas as categorias</option>
                    {allCategories.map(cat => (
                        <option key={cat} value={cat}>{categoryEmoji(cat)} {cat}</option>
                    ))}
                </select>

                <select id="filter-type" className={selectBase} value={filterType} onChange={e => setFilterType(e.target.value)}>
                    <option value="">Todos os tipos</option>
                    <option value="income">Receitas</option>
                    <option value="expense">Despesas</option>
                    <option value="transfer">Transferências</option>
                </select>
            </div>

            {/* Account Balance Cards */}
            {accounts.length > 0 && (
                <div className="flex gap-3 overflow-x-auto p-1 pb-3" style={{ scrollbarWidth: 'thin', scrollSnapType: 'x mandatory', scrollbarColor: 'var(--border) transparent' }}>
                    {accounts.map(acc => (
                        <div
                            key={acc.id}
                            className="flex flex-1 shrink-0 basis-[240px] min-w-[200px] flex-col gap-1 rounded-[var(--radius)] border px-5 py-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow)]"
                            style={{
                                borderLeftColor: acc.color, borderLeftWidth: 3, borderLeftStyle: 'solid',
                                scrollSnapAlign: 'start',
                                background: 'var(--card)',
                                borderTopColor: 'var(--border)',
                                borderRightColor: 'var(--border)',
                                borderBottomColor: 'var(--border)',
                            }}
                        >
                            <span className="mb-1.5 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold text-[var(--text-2)]">{acc.emoji || '🏦'} {acc.name}</span>
                            <span className="mb-1 text-[20px] font-bold tracking-tight font-mono" style={{ color: acc.color }}>{formatBRL(calcBalance(acc.id))}</span>
                            <span className="text-[11px] text-[var(--text-3)]">
                                Âncora: {acc.anchorDate} = {formatBRL(acc.anchorBalance)}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Stat Cards */}
            <div className="flex gap-3 overflow-x-auto p-1 pb-3" style={{ scrollbarWidth: 'thin', scrollSnapType: 'x mandatory', scrollbarColor: 'var(--border) transparent' }}>
                <div className="flex flex-col flex-1 min-w-[200px] flex-shrink-0 rounded-[var(--radius)] border border-[var(--border)] border-t-2 border-t-[var(--green)] bg-[var(--card)] px-[18px] py-[16px] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow)]" style={{ scrollSnapAlign: 'start' }}>
                    <div className="mb-2 flex items-center gap-[5px] text-[11px] font-medium uppercase tracking-[.06em] text-[var(--green)]">
                        <i className="bi bi-arrow-up-circle" /> Total Receitas
                    </div>
                    <div className="text-[22px] font-bold tracking-tight text-[var(--green)] font-mono">{formatBRL(totalIncome)}</div>
                </div>

                <div className="flex flex-col flex-1 min-w-[200px] flex-shrink-0 rounded-[var(--radius)] border border-[var(--border)] border-t-2 border-t-[var(--red)] bg-[var(--card)] px-[18px] py-[16px] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow)]" style={{ scrollSnapAlign: 'start' }}>
                    <div className="mb-2 flex items-center gap-[5px] text-[11px] font-medium uppercase tracking-[.06em] text-[var(--red)]">
                        <i className="bi bi-arrow-down-circle" /> Total Despesas
                    </div>
                    <div className="text-[22px] font-bold tracking-tight text-[var(--red)] font-mono">{formatBRL(totalExpense)}</div>
                </div>

                <div className="flex flex-col flex-1 min-w-[200px] flex-shrink-0 rounded-[var(--radius)] border border-[var(--border)] border-t-2 border-t-[var(--text)] bg-[var(--card)] px-[18px] py-[16px] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow)]" style={{ scrollSnapAlign: 'start' }}>
                    <div className="mb-2 flex items-center gap-[5px] text-[11px] font-medium uppercase tracking-[.06em] text-[var(--text)]">
                        <i className="bi bi-wallet2" /> Saldo do Período
                    </div>
                    <div className="text-[22px] font-bold tracking-tight font-mono" style={{ color: totalBalance >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {formatBRL(totalBalance)}
                    </div>
                </div>

                <div className="flex flex-col flex-1 min-w-[200px] flex-shrink-0 rounded-[var(--radius)] border border-[var(--border)] border-t-2 border-t-[var(--blue)] bg-[var(--card)] px-[18px] py-[16px] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow)]" style={{ scrollSnapAlign: 'start' }}>
                    <div className="mb-2 flex items-center gap-[5px] text-[11px] font-medium uppercase tracking-[.06em] text-[var(--blue)]">
                        <i className="bi bi-list-ul" /> Transações
                    </div>
                    <div className="text-[22px] font-bold tracking-tight text-[var(--blue)] font-mono">{filteredTransactions.length}</div>
                </div>
            </div>

            {/* Charts */}
            <div className="flex flex-col gap-4">
                {/* Income vs Expense (Full Width) */}
                <div className={`${cardBase}`}>
                    <h3 className="mb-4 text-sm font-semibold flex items-center gap-2">
                        Receitas vs Despesas{' '}
                        <span className={`font-normal text-[11px] text-[var(--text-3)]`}>Comparativo — últimos 6 meses</span>
                    </h3>
                    <div className="relative min-h-[280px] w-full overflow-x-auto">
                        <div className="min-w-[500px] h-full min-h-[280px]">
                            {filteredTransactions.length === 0 ? (
                                <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 text-[var(--text-3)]`}>
                                    <i className="bi bi-graph-up text-3xl" />
                                    <p className="text-sm">Sem dados para exibir</p>
                                </div>
                            ) : (
                                <canvas ref={chartIncVsExpRef} />
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom Charts Row */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className={`${cardBase}`}>
                        <h3 className="mb-4 text-sm font-semibold flex items-center gap-2">
                            Despesas por Categoria{' '}
                            <span className={`font-normal text-[11px] text-[var(--text-3)]`}>Distribuição do período</span>
                        </h3>
                        <div className="relative min-h-[280px] w-full">
                            {!hasExpenses ? (
                                <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 text-[var(--text-3)]`}>
                                    <i className="bi bi-pie-chart text-3xl" />
                                    <p className="text-sm">Sem despesas no período</p>
                                </div>
                            ) : (
                                <canvas ref={chartExpCatRef} />
                            )}
                        </div>
                    </div>

                    <div className={`${cardBase}`}>
                        <h3 className="mb-4 text-sm font-semibold flex items-center gap-2">
                            Maiores Gastos{' '}
                            <span className={`font-normal text-[11px] text-[var(--text-3)]`}>Top 7 por valor acumulado</span>
                        </h3>
                        <div className="relative min-h-[280px] w-full">
                            {!hasExpenses ? (
                                <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 text-[var(--text-3)]`}>
                                    <i className="bi bi-bar-chart text-3xl" />
                                    <p className="text-sm">Sem despesas no período</p>
                                </div>
                            ) : (
                                <canvas ref={chartTimelineRef} />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}