import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format, isSameDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { getItems, getCalendarEvents, getMonthlyBudget } from '../../lib/db';
import { formatPrice, parsePriceString } from '../../lib/utils';
import type { Item, CalendarEvent } from '../../lib/types';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar as CalendarIcon, Plus } from 'lucide-react';
import { Button } from '../ui/Button';
import './calendar-custom.css';

interface CalendarViewProps {
    onOpenEventForm: (date?: Date) => void;
    onItemClick: (item: Item) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ onOpenEventForm, onItemClick }) => {
    const { user } = useAuth();
    const [date, setDate] = useState<Date>(new Date());
    const [items, setItems] = useState<Item[]>([]);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [activeMonthStr, setActiveMonthStr] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [monthlyBudget, setMonthlyBudget] = useState<number>(0);

    useEffect(() => {
        const fetchBudget = async () => {
            if (!user) return;
            try {
                const budget = await getMonthlyBudget(activeMonthStr);
                setMonthlyBudget(budget);
            } catch (err) {
                console.error("Error fetching monthly budget:", err);
            }
        };
        fetchBudget();
    }, [user, activeMonthStr]);

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            try {
                const fetchedItems = await getItems();
                const fetchedEvents = await getCalendarEvents();
                
                // ターゲット日が設定されているか、既に入手済みのアイテムを表示
                setItems(fetchedItems.filter(i => i.target_date || i.obtained));
                setEvents(fetchedEvents);
            } catch (err) {
                console.error("Error fetching calendar data:", err);
            }
        };

        fetchData();
    }, [user]);

    // カレンダーの各日付セルにコンテンツを描画する関数
    const tileContent = ({ date, view }: { date: Date, view: string }) => {
        if (view !== 'month') return null;

        const dayItems = items.filter(i => {
            const isTargetDay = i.target_date && isSameDay(new Date(i.target_date), date);
            const isObtainedDay = i.obtained && i.obtainedAt && isSameDay(new Date(i.obtainedAt), date);
            return isTargetDay || isObtainedDay;
        });
        const dayEvents = events.filter(e => {
            const eventDate = new Date(e.event_date);
            if (e.is_annual) {
                return eventDate.getMonth() === date.getMonth() && eventDate.getDate() === date.getDate();
            }
            return isSameDay(eventDate, date);
        });

        if (dayItems.length === 0 && dayEvents.length === 0) return null;

        const allDayEntries = [
            ...dayEvents.map(e => ({ id: `e-${e.id}`, title: e.title, type: 'event', amount: null })),
            ...dayItems.map(i => {
                const isObtainedDay = i.obtained && i.obtainedAt && isSameDay(new Date(i.obtainedAt), date);
                return { 
                    id: `i-${i.id}`, 
                    title: isObtainedDay ? `✅ ${i.title}` : i.title, 
                    type: isObtainedDay ? 'obtained' : 'item', 
                    amount: i.price 
                };
            })
        ];

        const MAX_DISPLAY = 3; // スッキリしたので3件までに増やす
        const displayedEntries = allDayEntries.slice(0, MAX_DISPLAY);
        const remainingCount = allDayEntries.length - MAX_DISPLAY;

        return (
            <div className="calendar-tile-content-labels">
                {displayedEntries.map(entry => (
                    <div key={entry.id} className="calendar-item-wrapper">
                        <div className={`calendar-label ${entry.type === 'event' ? 'label-event' : entry.type === 'obtained' ? 'label-obtained' : 'label-item'}`} title={entry.title}>
                            {entry.title}
                        </div>
                        {entry.amount && (
                            <span className="calendar-amount">{formatPrice(entry.amount)}</span>
                        )}
                    </div>
                ))}
                {remainingCount > 0 && (
                    <div className="calendar-label-more">
                        +{remainingCount}件
                    </div>
                )}
            </div>
        );
    };

    // 選択された日付のアイテムとイベントを取得
    const selectedDayItems = items.filter(i => {
        const isTargetDay = i.target_date && isSameDay(new Date(i.target_date), date);
        const isObtainedDay = i.obtained && i.obtainedAt && isSameDay(new Date(i.obtainedAt), date);
        return isTargetDay || isObtainedDay;
    });
    const selectedDayEvents = events.filter(e => {
        const eventDate = new Date(e.event_date);
        if (e.is_annual) {
            return eventDate.getMonth() === date.getMonth() && eventDate.getDate() === date.getDate();
        }
        return isSameDay(eventDate, date);
    });

    const activeMonthTotal = items.filter(i => {
        if (!i.obtained || !i.obtainedAt) return false;
        const obtainedDate = new Date(i.obtainedAt);
        return `${obtainedDate.getFullYear()}-${String(obtainedDate.getMonth() + 1).padStart(2, '0')}` === activeMonthStr;
    }).reduce((sum, i) => sum + parsePriceString(i.price), 0);

    return (
        <div className="calendar-container glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    <CalendarIcon className="text-primary" />
                    記念日・期日カレンダー
                </h2>
                <Button variant="secondary" size="sm" onClick={() => onOpenEventForm(date)}>
                    <Plus size={16} /> 予定を追加
                </Button>
            </div>

            <div className="calendar-wrapper" style={{ marginBottom: '2rem' }}>
                {monthlyBudget > 0 && (
                    <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', alignItems: 'flex-end', padding: '0 0.5rem' }}>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>当月の支出</span>
                            <span style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--primary)', letterSpacing: '0.02em', lineHeight: 1 }}>
                                {formatPrice(activeMonthTotal)}
                            </span>
                        </div>
                        <div style={{ textAlign: 'right', borderLeft: '1px solid var(--glass-border)', paddingLeft: '1rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>当月の予算</span>
                            <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)', lineHeight: 1 }}>
                                {formatPrice(monthlyBudget)}
                            </span>
                        </div>
                    </div>
                )}
                <Calendar
                    onChange={(val) => setDate(val as Date)}
                    value={date}
                    onActiveStartDateChange={({ activeStartDate }) => {
                        if (activeStartDate) {
                            setActiveMonthStr(`${activeStartDate.getFullYear()}-${String(activeStartDate.getMonth() + 1).padStart(2, '0')}`);
                        }
                    }}

                    locale="ja-JP"
                    calendarType="gregory"
                    tileContent={tileContent}
                    className="custom-react-calendar"
                    formatDay={(_, date) => format(date, 'd')}
                />
            </div>

            <div className="selected-date-details">
                <h3 style={{ fontSize: '1.1rem', borderBottom: '2px solid var(--accent-primary)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                    {format(date, 'yyyy年M月d日 (E)', { locale: ja })} の予定
                </h3>

                {selectedDayItems.length === 0 && selectedDayEvents.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>予定はありません</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {selectedDayEvents.map(e => (
                            <div key={e.id} className="detail-card event-card">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    <div className="dot anniversary-dot"></div>
                                    {e.title}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                    {e.is_annual ? '毎年' : '1回限り'} • 作成者: {e.creator?.display_name || '不明'} 
                                    {e.group && ` • グループ: ${e.group.name}`}
                                </div>
                            </div>
                        ))}

                        {selectedDayItems.map(i => {
                            const isObtainedDay = i.obtained && i.obtainedAt && isSameDay(new Date(i.obtainedAt), date);
                            return (
                                <div 
                                    key={i.id} 
                                    className={`detail-card item-card ${isObtainedDay ? 'obtained-card' : ''}`} 
                                    onClick={() => onItemClick(i)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                        <div className={`dot ${isObtainedDay ? 'obtained-dot' : 'item-dot'}`}></div>
                                        {isObtainedDay ? `[入手済] ${i.title}` : i.title}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {i.price && <span>{formatPrice(i.price)}</span>}
                                        {i.creator?.display_name && <span>• {i.creator.display_name}のリスト</span>}
                                        {isObtainedDay && <span style={{ color: 'var(--success)', fontWeight: 600 }}>入手完了</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
