import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Search, Share2, Upload } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../contexts/AuthContext';
import { AuthModal } from '../components/AuthModal';
import { ItemCard } from '../components/ItemCard';
import { ItemForm } from '../components/ItemForm';
import { MonthlyExpenseChart } from '../components/MonthlyExpenseChart';
import { FriendManager } from '../components/friends/FriendManager';
import { GroupManager } from '../components/groups/GroupManager';
import { CalendarView } from '../components/calendar/CalendarView';
import { EventForm } from '../components/calendar/EventForm';
import { BottomNav } from '../components/layout/BottomNav';
import { FloatingActionButton } from '../components/layout/FloatingActionButton';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Settings } from './Settings';
import { addCalendarEvent, addItem, addMultipleItems, deleteItem, getItems, updateItem } from '../lib/db';
import { generateShareLink, importDataFromJsonFile, parseSharedItemsFromUrl } from '../lib/shareUtils';
import { formatPrice, parsePriceString } from '../lib/utils';
import type { Item } from '../lib/types';

type View = 'my-wishlist' | 'calendar' | 'friends' | 'groups' | 'settings';
type SortOrder = 'newest' | 'oldest' | 'priority';
type ObtainedFilter = 'all' | 'not_obtained' | 'obtained';

const getMonthKeyFromTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonthLabel = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    return `${year}年${month}月`;
};

export const Home: React.FC = () => {
    const { user } = useAuth();
    const [items, setItems] = useState<Item[]>([]);
    const [monthlyBudget, setMonthlyBudget] = useState(0);
    const [monthlyBudgetsMap, setMonthlyBudgetsMap] = useState<Record<string, number>>({});
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isEventFormOpen, setIsEventFormOpen] = useState(false);
    const [selectedEventDate, setSelectedEventDate] = useState<Date | undefined>(undefined);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Item | null>(null);
    const [currentView, setCurrentView] = useState<View>('my-wishlist');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterObtained, setFilterObtained] = useState<ObtainedFilter>('not_obtained');
    const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
    const [copySuccess, setCopySuccess] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadItems = useCallback(async () => {
        const data = await getItems();
        setItems(data);
    }, []);

    const loadProfileData = useCallback(async () => {
        if (!user) {
            setMonthlyBudget(0);
            return;
        }

        const { getMonthlyBudget } = await import('../lib/db');
        const currentMonth = getMonthKeyFromTimestamp(Date.now());
        const budget = await getMonthlyBudget(currentMonth);
        setMonthlyBudget(budget > 0 ? budget : 0);
    }, [user]);

    useEffect(() => {
        if (currentView === 'my-wishlist' || currentView === 'calendar') {
            void loadItems();
        }

        if (currentView === 'my-wishlist') {
            void loadProfileData();
        }
    }, [currentView, loadItems, loadProfileData]);

    useEffect(() => {
        const sharedData = parseSharedItemsFromUrl();
        if (!sharedData || sharedData.length === 0) return;

        const shouldImport = window.confirm(`${sharedData.length} 件のアイテムを共有リンクから取り込みますか？`);
        if (!shouldImport) {
            window.location.hash = '';
            return;
        }

        const importedItems = sharedData.map((item: Partial<Item>) => ({
            ...item,
            id: uuidv4(),
            createdAt: Date.now(),
            obtained: false
        } as Item));

        addMultipleItems(importedItems).then(() => {
            window.location.hash = '';
            void loadItems();
            window.alert('共有アイテムを取り込みました。');
        });
    }, [loadItems]);

    useEffect(() => {
        if (filterObtained !== 'obtained') return;

        const monthsToFetch = Array.from(
            new Set(
                items
                    .filter(item => item.obtained)
                    .map(item => getMonthKeyFromTimestamp(item.obtainedAt || item.createdAt))
            )
        );

        if (monthsToFetch.length === 0) {
            setMonthlyBudgetsMap({});
            return;
        }

        import('../lib/db').then(({ getMonthlyBudgets }) => {
            getMonthlyBudgets(monthsToFetch).then(setMonthlyBudgetsMap);
        });
    }, [filterObtained, items]);

    const categories = useMemo(() => {
        const values = items.map(item => item.category).filter((category): category is string => Boolean(category?.trim()));
        return ['all', ...Array.from(new Set(values))];
    }, [items]);

    useEffect(() => {
        if (selectedCategory !== 'all' && !categories.includes(selectedCategory)) {
            setSelectedCategory('all');
        }
    }, [categories, selectedCategory]);

    const handleSaveItem = async (item: Item) => {
        if (editingItem) {
            await updateItem(item);
        } else {
            await addItem(item);
        }
        await loadItems();
    };

    const handleToggleObtained = async (id: string, currentStatus: boolean) => {
        const item = items.find(entry => entry.id === id);
        if (!item) return;

        await updateItem({
            ...item,
            obtained: !currentStatus,
            obtainedAt: !currentStatus ? Date.now() : undefined
        });
        await loadItems();
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('このアイテムを削除しますか？')) return;

        await deleteItem(id);
        setIsFormOpen(false);
        setEditingItem(null);
        await loadItems();
    };

    const handleShareLink = async () => {
        if (items.length === 0) {
            window.alert('共有できるアイテムがありません。');
            return;
        }

        const link = generateShareLink(items);

        try {
            await navigator.clipboard.writeText(link);
            setCopySuccess(true);
            window.setTimeout(() => setCopySuccess(false), 2000);
        } catch (error) {
            console.error('Failed to copy share link', error);
            window.alert('共有リンクのコピーに失敗しました。');
        }
    };

    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const imported = await importDataFromJsonFile(file);
            const shouldImport = window.confirm(`${imported.length} 件のアイテムをインポートしますか？`);
            if (shouldImport) {
                await addMultipleItems(imported);
                await loadItems();
                window.alert('インポートが完了しました。');
            }
        } catch (error) {
            console.error('Import error:', error);
            window.alert('ファイルの読み込みに失敗しました。JSON ファイルを確認してください。');
        }

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const displayedItems = useMemo(() => {
        let result = [...items];

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(item =>
                item.title.toLowerCase().includes(query) ||
                (item.memo && item.memo.toLowerCase().includes(query))
            );
        }

        if (selectedCategory !== 'all') {
            result = result.filter(item => item.category === selectedCategory);
        }

        if (filterObtained === 'not_obtained') {
            result = result.filter(item => !item.obtained);
        } else if (filterObtained === 'obtained') {
            result = result.filter(item => item.obtained);
        }

        result.sort((a, b) => {
            if (a.obtained !== b.obtained) {
                return a.obtained ? 1 : -1;
            }

            if (sortOrder === 'newest') return b.createdAt - a.createdAt;
            if (sortOrder === 'oldest') return a.createdAt - b.createdAt;

            const priorityValues = { high: 3, mid: 2, low: 1 };
            const aPriority = priorityValues[a.priority || 'mid'];
            const bPriority = priorityValues[b.priority || 'mid'];
            if (aPriority !== bPriority) return bPriority - aPriority;
            return b.createdAt - a.createdAt;
        });

        return result;
    }, [filterObtained, items, searchQuery, selectedCategory, sortOrder]);

    const totalSpent = useMemo(
        () => items.filter(item => item.obtained).reduce((sum, item) => sum + parsePriceString(item.price), 0),
        [items]
    );

    const totalWishlistAmount = useMemo(
        () => items.filter(item => !item.obtained).reduce((sum, item) => sum + parsePriceString(item.price), 0),
        [items]
    );

    const pendingCount = useMemo(() => items.filter(item => !item.obtained).length, [items]);
    const obtainedCount = useMemo(() => items.filter(item => item.obtained).length, [items]);

    const groupedObtainedItems = useMemo(() => {
        return displayedItems.reduce<Record<string, Item[]>>((acc, item) => {
            const monthKey = getMonthKeyFromTimestamp(item.obtainedAt || item.createdAt);
            if (!acc[monthKey]) {
                acc[monthKey] = [];
            }
            acc[monthKey].push(item);
            return acc;
        }, {});
    }, [displayedItems]);

    const hasActiveFilters = Boolean(searchQuery) || selectedCategory !== 'all' || sortOrder !== 'newest';

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem 100px 1rem' }}>
            {currentView === 'calendar' && (
                <>
                    <CalendarView
                        onOpenEventForm={date => {
                            setSelectedEventDate(date);
                            setIsEventFormOpen(true);
                        }}
                        onItemClick={item => {
                            setEditingItem(item);
                            setIsFormOpen(true);
                        }}
                    />

                    <div style={{ marginTop: '2rem' }}>
                        <MonthlyExpenseChart items={items} />
                        {totalSpent > 0 && (
                            <div
                                style={{
                                    marginBottom: '1.5rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    padding: '0.75rem 1rem',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--glass-border)'
                                }}
                            >
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>これまでの支出合計</span>
                                <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '1.25rem', letterSpacing: '0.02em' }}>
                                    {formatPrice(totalSpent)}
                                </span>
                            </div>
                        )}
                    </div>
                </>
            )}
            {currentView === 'friends' && <FriendManager onBack={() => setCurrentView('my-wishlist')} />}
            {currentView === 'groups' && <GroupManager onBack={() => setCurrentView('my-wishlist')} />}
            {currentView === 'settings' && <Settings onBack={() => setCurrentView('my-wishlist')} />}

            {currentView === 'my-wishlist' && (
                <>
                    <header
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '2rem',
                            flexWrap: 'wrap',
                            gap: '1rem'
                        }}
                    >
                        <div>
                            <h1 className="text-gradient" style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                                Wishlist
                            </h1>
                            <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0 0' }}>欲しいものを整理して、共有や予算管理までひとつで進められます。</p>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <DropdownActionButtons
                                onShare={handleShareLink}
                                copySuccess={copySuccess}
                                onImportClick={() => fileInputRef.current?.click()}
                            />
                            <input type="file" accept=".json" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImport} />
                        </div>
                    </header>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                        <SummaryCard label="欲しいもの" value={`${pendingCount}件`} helper={formatPrice(totalWishlistAmount) || '金額未設定'} />
                        <SummaryCard label="入手済み" value={`${obtainedCount}件`} helper={formatPrice(totalSpent) || '0円'} />
                        <SummaryCard label="今月の予算" value={monthlyBudget > 0 ? formatPrice(monthlyBudget) : '未設定'} helper={monthlyBudget > 0 ? '設定をもとに比較できます' : '設定画面から登録できます'} />
                    </div>

                    <div
                        className="glass-panel"
                        style={{ padding: '1rem', marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}
                    >
                        <div style={{ flex: '1 1 280px' }}>
                            <Input
                                placeholder="タイトル・メモで検索"
                                icon={<Search size={18} />}
                                value={searchQuery}
                                onChange={event => setSearchQuery(event.target.value)}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <div className="input-wrapper" style={{ minWidth: '150px' }}>
                                <select className="input-field" value={sortOrder} onChange={event => setSortOrder(event.target.value as SortOrder)}>
                                    <option value="newest">新しい順</option>
                                    <option value="oldest">古い順</option>
                                    <option value="priority">優先度順</option>
                                </select>
                            </div>
                            {hasActiveFilters && (
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        setSearchQuery('');
                                        setSelectedCategory('all');
                                        setSortOrder('newest');
                                    }}
                                >
                                    フィルタをリセット
                                </Button>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)' }}>
                        <button
                            onClick={() => setFilterObtained('not_obtained')}
                            style={{
                                padding: '0.75rem 1.5rem',
                                fontSize: '1rem',
                                fontWeight: filterObtained === 'not_obtained' ? 600 : 400,
                                color: filterObtained === 'not_obtained' ? 'var(--primary)' : 'var(--text-secondary)',
                                background: 'none',
                                border: 'none',
                                borderBottom: filterObtained === 'not_obtained' ? '2px solid var(--primary)' : '2px solid transparent',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                marginBottom: '-1px'
                            }}
                        >
                            欲しいもの
                        </button>
                        <button
                            onClick={() => setFilterObtained('obtained')}
                            style={{
                                padding: '0.75rem 1.5rem',
                                fontSize: '1rem',
                                fontWeight: filterObtained === 'obtained' ? 600 : 400,
                                color: filterObtained === 'obtained' ? 'var(--primary)' : 'var(--text-secondary)',
                                background: 'none',
                                border: 'none',
                                borderBottom: filterObtained === 'obtained' ? '2px solid var(--primary)' : '2px solid transparent',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                marginBottom: '-1px'
                            }}
                        >
                            入手済み
                        </button>
                    </div>

                    {categories.length > 1 && (
                        <div
                            className="hide-scroll"
                            style={{
                                display: 'flex',
                                gap: '0.5rem',
                                overflowX: 'auto',
                                paddingBottom: '0.5rem',
                                marginBottom: '1.5rem',
                                scrollbarWidth: 'none',
                                msOverflowStyle: 'none'
                            }}
                        >
                            {categories.map(category => (
                                <button
                                    key={category}
                                    onClick={() => setSelectedCategory(category)}
                                    style={{
                                        padding: '0.4rem 1.2rem',
                                        borderRadius: '99px',
                                        background: selectedCategory === category ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                                        color: selectedCategory === category ? 'white' : 'var(--text-secondary)',
                                        border: `1px solid ${selectedCategory === category ? 'var(--primary)' : 'var(--glass-border)'}`,
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        fontSize: '0.875rem',
                                        transition: 'all 0.2s ease',
                                        fontWeight: selectedCategory === category ? 600 : 400
                                    }}
                                >
                                    {category === 'all' ? 'すべて' : category}
                                </button>
                            ))}
                        </div>
                    )}

                    {filterObtained === 'not_obtained' && (
                        <div
                            className="glass-panel"
                            style={{ padding: '1.25rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <div>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'block', marginBottom: '0.25rem' }}>
                                        リストの合計金額
                                    </span>
                                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.02em', lineHeight: 1 }}>
                                        {formatPrice(totalWishlistAmount)}
                                    </span>
                                </div>

                                <div style={{ textAlign: 'right' }}>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>
                                        今月の予算
                                    </span>
                                    {monthlyBudget > 0 ? (
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                            <span style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                                {formatPrice(monthlyBudget)}
                                            </span>
                                            <button
                                                onClick={() => setCurrentView('settings')}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    padding: 0,
                                                    color: 'var(--primary)',
                                                    fontSize: '0.75rem',
                                                    cursor: 'pointer',
                                                    textDecoration: 'underline'
                                                }}
                                            >
                                                設定
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                            <span style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-muted)' }}>未設定</span>
                                            <button
                                                onClick={() => setCurrentView('settings')}
                                                style={{
                                                    background: 'none',
                                                    border: '1px solid var(--primary)',
                                                    borderRadius: '99px',
                                                    padding: '0.25rem 0.75rem',
                                                    color: 'var(--primary)',
                                                    fontSize: '0.75rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                予算を設定する
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {monthlyBudget > 0 && (
                                <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', overflow: 'hidden', marginTop: '0.5rem' }}>
                                    <div
                                        style={{
                                            height: '100%',
                                            background: totalWishlistAmount > monthlyBudget ? 'var(--danger)' : 'var(--primary)',
                                            width: `${Math.min((totalWishlistAmount / monthlyBudget) * 100, 100)}%`,
                                            transition: 'width 0.5s ease',
                                            borderRadius: '4px'
                                        }}
                                    />
                                </div>
                            )}

                            {monthlyBudget > 0 && totalWishlistAmount > monthlyBudget && (
                                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'var(--danger)', textAlign: 'right' }}>
                                    予算を {formatPrice(totalWishlistAmount - monthlyBudget)} オーバーしています。
                                </p>
                            )}
                        </div>
                    )}

                    {displayedItems.length > 0 ? (
                        filterObtained === 'obtained' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                                {Object.keys(groupedObtainedItems)
                                    .sort((a, b) => b.localeCompare(a))
                                    .map(monthKey => {
                                        const itemsInMonth = groupedObtainedItems[monthKey];
                                        const monthTotal = itemsInMonth.reduce((sum, item) => sum + parsePriceString(item.price), 0);
                                        const budgetForMonth = monthlyBudgetsMap[monthKey] || 0;

                                        return (
                                            <div key={monthKey}>
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        marginBottom: '1rem',
                                                        borderBottom: '1px solid var(--glass-border)',
                                                        paddingBottom: '0.5rem',
                                                        flexWrap: 'wrap',
                                                        gap: '0.5rem'
                                                    }}
                                                >
                                                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>{formatMonthLabel(monthKey)}</h2>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>支出合計</span>
                                                            <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--primary)', letterSpacing: '0.02em' }}>
                                                                {formatPrice(monthTotal)}
                                                            </span>
                                                        </div>
                                                        {budgetForMonth > 0 && (
                                                            <div style={{ textAlign: 'right', borderLeft: '1px solid var(--glass-border)', paddingLeft: '1rem' }}>
                                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>予算</span>
                                                                <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                                                    {formatPrice(budgetForMonth)}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {budgetForMonth > 0 && (
                                                    <div style={{ marginBottom: '1rem', width: '100%' }}>
                                                        <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                                                            <div
                                                                style={{
                                                                    height: '100%',
                                                                    background: monthTotal > budgetForMonth ? 'var(--danger)' : 'var(--primary)',
                                                                    width: `${Math.min((monthTotal / budgetForMonth) * 100, 100)}%`,
                                                                    transition: 'width 0.5s ease',
                                                                    borderRadius: '2px'
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '1rem' }}>
                                                    {itemsInMonth.map(item => (
                                                        <ItemCard
                                                            key={item.id}
                                                            item={item}
                                                            currentUserId={user?.id}
                                                            onReserve={async () => undefined}
                                                            onCancelReservation={async () => undefined}
                                                            onToggleObtained={handleToggleObtained}
                                                            onClick={selectedItem => {
                                                                setEditingItem(selectedItem);
                                                                setIsFormOpen(true);
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '1rem' }}>
                                {displayedItems.map(item => (
                                    <ItemCard
                                        key={item.id}
                                        item={item}
                                        currentUserId={user?.id}
                                        onReserve={async () => undefined}
                                        onCancelReservation={async () => undefined}
                                        onToggleObtained={handleToggleObtained}
                                        onClick={selectedItem => {
                                            setEditingItem(selectedItem);
                                            setIsFormOpen(true);
                                        }}
                                    />
                                ))}
                            </div>
                        )
                    ) : (
                        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
                            <p style={{ fontSize: '1.125rem', marginBottom: '0.75rem' }}>
                                {items.length === 0 ? 'アイテムがまだありません' : '条件に合うアイテムがありません'}
                            </p>
                            <p style={{ margin: 0 }}>
                                {items.length === 0 ? '最初のアイテムを追加してリストを作り始めましょう。' : '検索やカテゴリ条件を見直してみてください。'}
                            </p>
                            {items.length === 0 && (
                                <button className="btn btn-ghost" onClick={() => { setEditingItem(null); setIsFormOpen(true); }} style={{ marginTop: '1rem' }}>
                                    + 最初のアイテムを追加する
                                </button>
                            )}
                        </div>
                    )}
                </>
            )}

            <ItemForm
                isOpen={isFormOpen}
                onClose={() => {
                    setIsFormOpen(false);
                    setEditingItem(null);
                }}
                onSave={handleSaveItem}
                onDelete={handleDelete}
                initialData={editingItem}
            />

            {isEventFormOpen && (
                <EventForm
                    key={selectedEventDate?.toISOString() ?? 'new-event'}
                    isOpen={isEventFormOpen}
                    onClose={() => setIsEventFormOpen(false)}
                    onSave={async eventData => {
                        await addCalendarEvent(eventData);
                        const previousView = currentView;
                        setCurrentView('my-wishlist');
                        window.setTimeout(() => setCurrentView(previousView), 10);
                    }}
                    initialDate={selectedEventDate}
                />
            )}

            <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

            <FloatingActionButton
                onClick={() => {
                    setEditingItem(null);
                    setIsFormOpen(true);
                }}
                visible={['my-wishlist', 'groups'].includes(currentView)}
            />

            <BottomNav currentView={currentView} onNavigate={setCurrentView} onAuthRequest={() => setIsAuthModalOpen(true)} />
        </div>
    );
};

interface DropdownActionButtonsProps {
    onShare: () => void;
    copySuccess: boolean;
    onImportClick: () => void;
}

const DropdownActionButtons: React.FC<DropdownActionButtonsProps> = ({ onShare, copySuccess, onImportClick }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    return (
        <div ref={menuRef} style={{ position: 'relative' }}>
            <Button variant="secondary" onClick={() => setIsOpen(previous => !previous)} icon={<Share2 size={18} />} aria-expanded={isOpen}>
                共有・取込
            </Button>
            {isOpen && (
                <div
                    className="glass-panel"
                    style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        zIndex: 100,
                        marginTop: '0.5rem',
                        minWidth: '180px',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}
                >
                    <button
                        className="btn btn-ghost"
                        style={{ padding: '0.75rem 1rem', justifyContent: 'flex-start' }}
                        onClick={() => {
                            void onShare();
                            setIsOpen(false);
                        }}
                    >
                        {copySuccess ? <Check size={16} /> : <Share2 size={16} />} {copySuccess ? 'コピーしました' : '共有リンクをコピー'}
                    </button>
                    <button
                        className="btn btn-ghost"
                        style={{ padding: '0.75rem 1rem', justifyContent: 'flex-start' }}
                        onClick={() => {
                            onImportClick();
                            setIsOpen(false);
                        }}
                    >
                        <Upload size={16} /> JSON を読み込む
                    </button>
                </div>
            )}
        </div>
    );
};

interface SummaryCardProps {
    label: string;
    value: string;
    helper: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, helper }) => {
    return (
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{label}</span>
            <strong style={{ fontSize: '1.35rem', lineHeight: 1.2 }}>{value}</strong>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{helper}</span>
        </div>
    );
};
