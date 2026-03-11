import React, { useMemo, useState, useEffect } from 'react';
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Sector
} from 'recharts';
import type { Item } from '../lib/types';
import { parsePriceString, formatPrice } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { getProfile, updateProfile } from '../lib/db';
import { Edit2, Save, X } from 'lucide-react';

interface MonthlyExpenseChartProps {
    items: Item[];
}

// 円グラフ用のカラーパレット
const COLORS = [
    '#3b82f6', // blue-500
    '#10b981', // emerald-500
    '#f59e0b', // amber-500
    '#ef4444', // red-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#06b6d4', // cyan-500
    '#f97316', // orange-500
    '#84cc16', // lime-500
    '#6366f1', // indigo-500
];

// ホバー時のカスタムシェイプ
const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;

    return (
        <g>
            {/* 中央のテキスト情報 */}
            <text x={cx} y={cy - 10} dy={8} textAnchor="middle" fill={fill} fontSize={18} fontWeight="bold">
                {payload.name}
            </text>
            <text x={cx} y={cy + 15} dy={8} textAnchor="middle" fill="#fff" fontSize={16} fontWeight={600}>
                {formatPrice(value)}
            </text>
            <text x={cx} y={cy + 35} dy={8} textAnchor="middle" fill="var(--text-secondary)" fontSize={12}>
                {`(${(percent * 100).toFixed(1)}%)`}
            </text>

            {/* ホバーされたスライスを少し外側に膨らませる */}
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerRadius}
                outerRadius={outerRadius + 8}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
            />
            {/* スライスの外側に縁取りエフェクト */}
            <Sector
                cx={cx}
                cy={cy}
                startAngle={startAngle}
                endAngle={endAngle}
                innerRadius={outerRadius + 10}
                outerRadius={outerRadius + 13}
                fill={fill}
            />
        </g>
    );
};

export const MonthlyExpenseChart: React.FC<MonthlyExpenseChartProps> = ({ items }) => {
    const { user } = useAuth();
    const [activeIndex, setActiveIndex] = useState(0);
    const [budget, setBudget] = useState<number | null>(null);
    const [isEditingBudget, setIsEditingBudget] = useState(false);
    const [budgetInput, setBudgetInput] = useState('');

    useEffect(() => {
        if (user) {
            getProfile(user.id).then(profile => {
                if (profile && profile.monthly_budget != null) {
                    setBudget(profile.monthly_budget);
                    setBudgetInput(profile.monthly_budget.toString());
                }
            });
        }
    }, [user]);

    const handleSaveBudget = async () => {
        if (!user) return;
        const newBudget = parseInt(budgetInput, 10);
        const finalBudget = isNaN(newBudget) ? 0 : newBudget;
        await updateProfile({ id: user.id, monthly_budget: finalBudget });
        setBudget(finalBudget);
        setIsEditingBudget(false);
    };

    const onPieEnter = (_: any, index: number) => {
        setActiveIndex(index);
    };

    // 存在する月（YYYY年MM月）のリストを抽出
    const availableMonths = useMemo(() => {
        const obtainedItems = items.filter(item => item.obtained);
        const months = new Set<string>();
        obtainedItems.forEach(item => {
            const date = new Date(item.obtainedAt || item.createdAt);
            const monthKey = `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月`;
            months.add(monthKey);
        });
        return Array.from(months).sort((a, b) => b.localeCompare(a)); // 新しい順
    }, [items]);

    const [selectedMonth, setSelectedMonth] = useState<string>('all');
    useEffect(() => {
        if (selectedMonth === 'all' && availableMonths.length > 0) {
            setSelectedMonth(availableMonths[0]);
        }
    }, [availableMonths]);

    const chartData = useMemo(() => {
        // 入手済みのアイテムのみを対象とする
        let obtainedItems = items.filter(item => item.obtained);

        // 選択された月でフィルタリング
        if (selectedMonth !== 'all') {
            obtainedItems = obtainedItems.filter(item => {
                const date = new Date(item.obtainedAt || item.createdAt);
                const monthKey = `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月`;
                return monthKey === selectedMonth;
            });
        }

        if (obtainedItems.length === 0) {
            return [];
        }

        // カテゴリー別合計金額を集計
        const dataMap: Record<string, number> = {};

        obtainedItems.forEach(item => {
            const category = item.category?.trim() || '未分類';
            const price = parsePriceString(item.price);

            if (!dataMap[category]) {
                dataMap[category] = 0;
            }
            dataMap[category] += price;
        });

        // RechartsのPieChartが受け取れる形に変換し、金額が大きい順にソート
        return Object.keys(dataMap)
            .map(key => ({
                name: key,
                value: dataMap[key]
            }))
            .sort((a, b) => b.value - a.value);

    }, [items, selectedMonth]);

    // グラフ全体を表示しない条件を削除し、常に予算UIは表示させる
    // 取得したアイテムがない場合の円グラフエリアの表示は下部で処理する

    const totalAmount = chartData.reduce((sum, item) => sum + item.value, 0);

    // Tooltipのカスタマイズ
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0];
            // 該当期間の合計が0の場合は0% (通常は起きないが念のため)
            const percent = totalAmount > 0 ? ((data.value / totalAmount) * 100).toFixed(1) : "0.0";

            return (
                <div style={{
                    backgroundColor: 'rgba(20, 20, 20, 0.95)',
                    border: '1px solid var(--glass-border)',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    color: 'white',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
                    minWidth: '120px',
                    pointerEvents: 'none'
                }}>
                    <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', borderBottom: '1px solid #444', paddingBottom: '0.25rem', color: data.payload.fill }}>
                        {data.name}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0' }}>
                        <span style={{ fontWeight: 600 }}>{formatPrice(data.value)}</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{percent}%</span>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div style={{
            width: '100%',
            height: '550px', // 予算プログレスバー用に高さを広げる
            minHeight: '480px',
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.5rem',
            marginBottom: '2rem',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* 予算設定・進捗エリア */}
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
                                <button onClick={handleSaveBudget} style={{ background: 'var(--primary)', border: 'none', borderRadius: '4px', cursor: 'pointer', color: 'white', padding: '4px 8px', display: 'flex', alignItems: 'center' }}><Save size={14} /></button>
                                <button onClick={() => { setIsEditingBudget(false); setBudgetInput(budget?.toString() || ''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex' }}><X size={16} /></button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '1.1rem' }}>{budget != null && budget > 0 ? formatPrice(budget) : '未設定'}</span>
                                <button onClick={() => setIsEditingBudget(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', borderRadius: '4px' }}><Edit2 size={14} /></button>
                            </div>
                        )}
                    </div>
                    {budget != null && budget > 0 && selectedMonth !== 'all' && (
                        <div style={{ fontSize: '0.875rem', color: totalAmount > budget ? 'var(--danger)' : 'var(--text-secondary)' }}>
                            使用額: {formatPrice(totalAmount)} <span style={{ opacity: 0.7 }}>(残り: {formatPrice(Math.max(0, budget - totalAmount))})</span>
                        </div>
                    )}
                    {budget != null && budget > 0 && selectedMonth === 'all' && (
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                            月を選択すると進捗が表示されます
                        </div>
                    )}
                </div>
                {budget != null && budget > 0 && selectedMonth !== 'all' && (
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%',
                            width: `${Math.min(100, (totalAmount / budget) * 100)}%`,
                            background: totalAmount > budget ? 'var(--danger)' : 'var(--primary)',
                            transition: 'width 0.3s ease'
                        }} />
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h3 style={{ marginTop: 0, marginBottom: '0.25rem', fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
                        カテゴリー別 購入割合
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        円の一部にカーソルを合わせると詳細が表示されます
                    </p>
                </div>

                {/* 期間選択ドロップダウン */}
                <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
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
                    <option value="all">全期間</option>
                    {availableMonths.map(month => (
                        <option key={month} value={month}>
                            {month}
                        </option>
                    ))}
                </select>
            </div>

            {chartData.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    {selectedMonth} の購入データはありません。
                </div>
            ) : (
                <ResponsiveContainer width="100%" height="85%">
                    <PieChart>
                        <Pie
                            {...({
                                activeIndex: activeIndex,
                                activeShape: renderActiveShape
                            } as any)}
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}  // 穴を大きくして文字を入れるスペースを確保
                            outerRadius={110} // 全体の大きさを調整
                            fill="#8884d8"
                            dataKey="value"
                            stroke="var(--glass-bg)"
                            strokeWidth={2}
                            startAngle={90}  // 上中心から開始
                            endAngle={-270} // 時計回りに描画される
                            onMouseEnter={onPieEnter}
                        >
                            {chartData.map((_entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: '20px' }} />
                    </PieChart>
                </ResponsiveContainer>
            )}
        </div>
    );
};
