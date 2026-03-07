import React, { useMemo, useState } from 'react';
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
import { parsePriceString } from '../lib/utils';

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
                ¥{value.toLocaleString()}
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
    const [activeIndex, setActiveIndex] = useState(0);

    const onPieEnter = (_: any, index: number) => {
        setActiveIndex(index);
    };

    const chartData = useMemo(() => {
        // 入手済みのアイテムのみを対象とする
        const obtainedItems = items.filter(item => item.obtained);

        if (obtainedItems.length === 0) {
            return [];
        }

        // 全期間のカテゴリー別合計金額を集計
        const dataMap: Record<string, number> = {};

        obtainedItems.forEach(item => {
            const category = item.category?.trim() || '未分類';
            const price = parsePriceString(item.price);

            if (!dataMap[category]) {
                dataMap[category] = 0;
            }
            dataMap[category] += price;
        });

        // RechartsのPieChartが受け取れる形 {name: string, value: number} の配列に変換し、金額が大きい順にソート
        return Object.keys(dataMap)
            .map(key => ({
                name: key,
                value: dataMap[key]
            }))
            .sort((a, b) => b.value - a.value);

    }, [items]);

    if (chartData.length === 0) {
        return null; // 入手済みデータがない場合は何も表示しない
    }

    const totalAmount = chartData.reduce((sum, item) => sum + item.value, 0);

    // Tooltipのカスタマイズ（金額と割合(%)を表示）
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0];
            const percent = ((data.value / totalAmount) * 100).toFixed(1);

            return (
                <div style={{
                    backgroundColor: 'rgba(20, 20, 20, 0.95)',
                    border: '1px solid var(--glass-border)',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    color: 'white',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
                    minWidth: '120px',
                    pointerEvents: 'none' // ホバーの妨げにならないように
                }}>
                    <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', borderBottom: '1px solid #444', paddingBottom: '0.25rem', color: data.payload.fill }}>
                        {data.name}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0' }}>
                        <span style={{ fontWeight: 600 }}>¥{data.value.toLocaleString()}</span>
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
            height: '450px', // ドーナツの穴を大きくして文字を入れるため高さを少し大きく
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.5rem',
            marginBottom: '2rem'
        }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '1.1rem', color: 'var(--text-secondary)' }}>カテゴリー別 購入割合（全期間）</h3>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>円の一部にカーソルを合わせると詳細が表示されます</p>
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
        </div>
    );
};
