import React, { useEffect, useMemo, useState } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Edit2, Save, X } from 'lucide-react';
import { getProfile, updateProfile } from '../lib/db';
import type { Item } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import { formatPrice, parsePriceString } from '../lib/utils';

interface MonthlyExpenseChartProps {
    items: Item[];
}

type ChartDatum = {
    name: string;
    value: number;
};

type TooltipEntry = {
    name: string;
    value: number;
    color?: string;
};

type TooltipProps = {
    active?: boolean;
    payload?: TooltipEntry[];
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1'];

const formatMonthLabel = (date: Date) => `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月`;

const MonthlyExpenseTooltip: React.FC<TooltipProps & { totalAmount: number }> = ({ active, payload, totalAmount }) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0];
    const percent = totalAmount > 0 ? ((data.value / totalAmount) * 100).toFixed(1) : '0.0';

    return (
        <div
            style={{
                backgroundColor: 'rgba(20, 20, 20, 0.95)',
                border: '1px solid var(--glass-border)',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                color: 'white',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
                minWidth: '120px',
                pointerEvents: 'none'
            }}
        >
            <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', borderBottom: '1px solid #444', paddingBottom: '0.25rem', color: data.color }}>
                {data.name}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: 0 }}>
                <span style={{ fontWeight: 600 }}>{formatPrice(data.value)}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{percent}%</span>
            </div>
        </div>
    );
};

export const MonthlyExpenseChart: React.FC<MonthlyExpenseChartProps> = ({ items }) => {
    const { user } = useAuth();
    const [budget, setBudget] = useState<number | null>(null);
    const [isEditingBudget, setIsEditingBudget] = useState(false);
    const [budgetInput, setBudgetInput] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('all');

    useEffect(() => {
        if (!user) return;

        getProfile(user.id).then(profile => {
            if (profile?.monthly_budget != null) {
                setBudget(profile.monthly_budget);
                setBudgetInput(profile.monthly_budget.toString());
            }
        });
    }, [user]);

    const handleSaveBudget = async () => {
        if (!user) return;

        const parsedBudget = parseInt(budgetInput, 10);
        const nextBudget = Number.isNaN(parsedBudget) ? 0 : parsedBudget;
        await updateProfile({ id: user.id, monthly_budget: nextBudget });
        setBudget(nextBudget);
        setIsEditingBudget(false);
    };

    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        items
            .filter(item => item.obtained)
            .forEach(item => {
                const date = new Date(item.obtainedAt || item.createdAt);
                months.add(formatMonthLabel(date));
            });

        return Array.from(months).sort((a, b) => b.localeCompare(a));
    }, [items]);

    const effectiveMonth = useMemo(() => {
        if (selectedMonth !== 'all' && availableMonths.includes(selectedMonth)) {
            return selectedMonth;
        }

        return availableMonths[0] || 'all';
    }, [availableMonths, selectedMonth]);

    const chartData = useMemo<ChartDatum[]>(() => {
        let obtainedItems = items.filter(item => item.obtained);

        if (effectiveMonth !== 'all') {
            obtainedItems = obtainedItems.filter(item => {
                const date = new Date(item.obtainedAt || item.createdAt);
                return formatMonthLabel(date) === effectiveMonth;
            });
        }

        const totals: Record<string, number> = {};
        obtainedItems.forEach(item => {
            const category = item.category?.trim() || '未分類';
            totals[category] = (totals[category] || 0) + parsePriceString(item.price);
        });

        return Object.entries(totals)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [effectiveMonth, items]);

    const totalAmount = chartData.reduce((sum, item) => sum + item.value, 0);

    return (
        <div
            style={{
                width: '100%',
                height: '550px',
                minHeight: '480px',
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.5rem',
                marginBottom: '2rem',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>月の予算</span>
                        {isEditingBudget ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                    type="number"
                                    value={budgetInput}
                                    onChange={e => setBudgetInput(e.target.value)}
                                    style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', width: '100px', outline: 'none' }}
                                    autoFocus
                                    placeholder="金額"
                                />
                                <button onClick={handleSaveBudget} style={{ background: 'var(--primary)', border: 'none', borderRadius: '4px', cursor: 'pointer', color: 'white', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
                                    <Save size={14} />
                                </button>
                                <button onClick={() => { setIsEditingBudget(false); setBudgetInput(budget?.toString() || ''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex' }}>
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '1.1rem' }}>{budget != null && budget > 0 ? formatPrice(budget) : '未設定'}</span>
                                <button onClick={() => setIsEditingBudget(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', borderRadius: '4px' }}>
                                    <Edit2 size={14} />
                                </button>
                            </div>
                        )}
                    </div>

                    {budget != null && budget > 0 && effectiveMonth !== 'all' && (
                        <div style={{ fontSize: '0.875rem', color: totalAmount > budget ? 'var(--danger)' : 'var(--text-secondary)' }}>
                            使用額 {formatPrice(totalAmount)} <span style={{ opacity: 0.7 }}>(残り: {formatPrice(Math.max(0, budget - totalAmount))})</span>
                        </div>
                    )}
                </div>

                {budget != null && budget > 0 && effectiveMonth !== 'all' && (
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                            style={{
                                height: '100%',
                                width: `${Math.min(100, (totalAmount / budget) * 100)}%`,
                                background: totalAmount > budget ? 'var(--danger)' : 'var(--primary)',
                                transition: 'width 0.3s ease'
                            }}
                        />
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h3 style={{ marginTop: 0, marginBottom: '0.25rem', fontSize: '1.1rem', color: 'var(--text-secondary)' }}>カテゴリ別の支出内訳</h3>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>購入済みアイテムをカテゴリごとに集計しています。</p>
                </div>

                <select
                    value={effectiveMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                    style={{
                        padding: '0.5rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--glass-border)',
                        color: 'var(--text-primary)',
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        outline: 'none'
                    }}
                >
                    {availableMonths.length === 0 ? (
                        <option value="all">対象月なし</option>
                    ) : (
                        availableMonths.map(month => (
                            <option key={month} value={month}>
                                {month}
                            </option>
                        ))
                    )}
                </select>
            </div>

            {chartData.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    集計できるデータがありません。
                </div>
            ) : (
                <ResponsiveContainer width="100%" height="85%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={110}
                            fill="#8884d8"
                            dataKey="value"
                            stroke="var(--glass-bg)"
                            strokeWidth={2}
                            startAngle={90}
                            endAngle={-270}
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`${entry.name}-${entry.value}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            content={tooltipProps => (
                                <MonthlyExpenseTooltip
                                    active={tooltipProps.active}
                                    payload={tooltipProps.payload as TooltipEntry[] | undefined}
                                    totalAmount={totalAmount}
                                />
                            )}
                        />
                        <Legend verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: '20px' }} />
                    </PieChart>
                </ResponsiveContainer>
            )}
        </div>
    );
};
