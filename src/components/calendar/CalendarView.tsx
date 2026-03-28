import React, { useEffect, useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format, isSameDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Calendar as CalendarIcon, Plus } from 'lucide-react';
import { getCalendarEvents, getItems, getMonthlyBudget } from '../../lib/db';
import type { CalendarEvent, Item } from '../../lib/types';
import { formatPrice, parsePriceString } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
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
    const [activeMonthStr, setActiveMonthStr] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [monthlyBudget, setMonthlyBudget] = useState(0);

    useEffect(() => {
        const fetchBudget = async () => {
            if (!user) return;
            try {
                const budget = await getMonthlyBudget(activeMonthStr);
                setMonthlyBudget(budget);
            } catch (err) {
                console.error('Error fetching monthly budget:', err);
            }
        };

        void fetchBudget();
    }, [activeMonthStr, user]);

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            try {
                const fetchedItems = await getItems();
                const fetchedEvents = await getCalendarEvents();
                setItems(fetchedItems.filter(item => item.target_date || item.obtained));
                setEvents(fetchedEvents);
            } catch (err) {
                console.error('Error fetching calendar data:', err);
            }
        };

        void fetchData();
    }, [user]);

    const tileContent = ({ date: tileDate, view }: { date: Date; view: string }) => {
        if (view !== 'month') return null;

        const dayItems = items.filter(item => {
            const isTargetDay = item.target_date && isSameDay(new Date(item.target_date), tileDate);
            const isObtainedDay = item.obtained && item.obtainedAt && isSameDay(new Date(item.obtainedAt), tileDate);
            return isTargetDay || isObtainedDay;
        });

        const dayEvents = events.filter(event => {
            const eventDate = new Date(event.event_date);
            if (event.is_annual) {
                return eventDate.getMonth() === tileDate.getMonth() && eventDate.getDate() === tileDate.getDate();
            }
            return isSameDay(eventDate, tileDate);
        });

        if (dayItems.length === 0 && dayEvents.length === 0) return null;

        const allDayEntries = [
            ...dayEvents.map(event => ({ id: `e-${event.id}`, title: event.title, type: 'event' as const, amount: null })),
            ...dayItems.map(item => {
                const isObtainedDay = item.obtained && item.obtainedAt && isSameDay(new Date(item.obtainedAt), tileDate);
                return {
                    id: `i-${item.id}`,
                    title: isObtainedDay ? `購入: ${item.title}` : item.title,
                    type: isObtainedDay ? ('obtained' as const) : ('item' as const),
                    amount: item.price
                };
            })
        ];

        const maxDisplay = 3;
        const displayedEntries = allDayEntries.slice(0, maxDisplay);
        const remainingCount = allDayEntries.length - maxDisplay;

        return (
            <div className="calendar-tile-content-labels">
                {displayedEntries.map(entry => (
                    <div key={entry.id} className="calendar-item-wrapper">
                        <div className={`calendar-label ${entry.type === 'event' ? 'label-event' : entry.type === 'obtained' ? 'label-obtained' : 'label-item'}`} title={entry.title}>
                            {entry.title}
                        </div>
                        {entry.amount && <span className="calendar-amount">{formatPrice(entry.amount)}</span>}
                    </div>
                ))}
                {remainingCount > 0 && <div className="calendar-label-more">+{remainingCount}件</div>}
            </div>
        );
    };

    const selectedDayItems = items.filter(item => {
        const isTargetDay = item.target_date && isSameDay(new Date(item.target_date), date);
        const isObtainedDay = item.obtained && item.obtainedAt && isSameDay(new Date(item.obtainedAt), date);
        return isTargetDay || isObtainedDay;
    });

    const selectedDayEvents = events.filter(event => {
        const eventDate = new Date(event.event_date);
        if (event.is_annual) {
            return eventDate.getMonth() === date.getMonth() && eventDate.getDate() === date.getDate();
        }
        return isSameDay(eventDate, date);
    });

    const activeMonthTotal = items
        .filter(item => {
            if (!item.obtained || !item.obtainedAt) return false;
            const obtainedDate = new Date(item.obtainedAt);
            return `${obtainedDate.getFullYear()}-${String(obtainedDate.getMonth() + 1).padStart(2, '0')}` === activeMonthStr;
        })
        .reduce((sum, item) => sum + parsePriceString(item.price), 0);

    return (
        <div className="calendar-container glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    <CalendarIcon className="text-primary" />
                    イベント・月間カレンダー
                </h2>
                <Button variant="secondary" size="sm" onClick={() => onOpenEventForm(date)}>
                    <Plus size={16} /> 予定を追加
                </Button>
            </div>

            <div className="calendar-wrapper" style={{ marginBottom: '2rem' }}>
                {monthlyBudget > 0 && (
                    <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', alignItems: 'flex-end', padding: '0 0.5rem' }}>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>今月の支出</span>
                            <span style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--primary)', letterSpacing: '0.02em', lineHeight: 1 }}>
                                {formatPrice(activeMonthTotal)}
                            </span>
                        </div>
                        <div style={{ textAlign: 'right', borderLeft: '1px solid var(--glass-border)', paddingLeft: '1rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>今月の予算</span>
                            <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)', lineHeight: 1 }}>
                                {formatPrice(monthlyBudget)}
                            </span>
                        </div>
                    </div>
                )}

                <Calendar
                    onChange={val => setDate(val as Date)}
                    value={date}
                    onActiveStartDateChange={({ activeStartDate }) => {
                        if (!activeStartDate) return;
                        setActiveMonthStr(`${activeStartDate.getFullYear()}-${String(activeStartDate.getMonth() + 1).padStart(2, '0')}`);
                    }}
                    locale="ja-JP"
                    calendarType="gregory"
                    tileContent={tileContent}
                    className="custom-react-calendar"
                    formatDay={(_, currentDate) => format(currentDate, 'd')}
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
                        {selectedDayEvents.map(event => (
                            <div key={event.id} className="detail-card event-card">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    <div className="dot anniversary-dot"></div>
                                    {event.title}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                    {event.is_annual ? '毎年' : '1回のみ'} ・ 作成者: {event.creator?.display_name || 'ユーザー'}
                                    {event.group && ` ・ グループ: ${event.group.name}`}
                                </div>
                            </div>
                        ))}

                        {selectedDayItems.map(item => {
                            const isObtainedDay = item.obtained && item.obtainedAt && isSameDay(new Date(item.obtainedAt), date);
                            return (
                                <div
                                    key={item.id}
                                    className={`detail-card item-card ${isObtainedDay ? 'obtained-card' : ''}`}
                                    onClick={() => onItemClick(item)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                        <div className={`dot ${isObtainedDay ? 'obtained-dot' : 'item-dot'}`}></div>
                                        {isObtainedDay ? `[購入済み] ${item.title}` : item.title}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {item.price && <span>{formatPrice(item.price)}</span>}
                                        {item.creator?.display_name && <span>・ {item.creator.display_name}のリスト</span>}
                                        {isObtainedDay && <span style={{ color: 'var(--success)', fontWeight: 600 }}>購入記録</span>}
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
