import React, { useState, useEffect, useMemo } from 'react';
import { getItems, addItem, updateItem, deleteItem, addMultipleItems } from '../lib/db';
import type { Item } from '../lib/types';
import { generateShareLink, parseSharedItemsFromUrl, importDataFromJsonFile } from '../lib/shareUtils';
import { ItemCard } from '../components/ItemCard';
import { ItemForm } from '../components/ItemForm';
import { parsePriceString, formatPrice } from '../lib/utils';
import { AuthModal } from '../components/AuthModal';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Check, Share2, Upload, Search } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../contexts/AuthContext';
import { FriendManager } from '../components/friends/FriendManager';
import { GroupManager } from '../components/groups/GroupManager';
import { Settings } from './Settings';
import { MonthlyExpenseChart } from '../components/MonthlyExpenseChart';
import { BottomNav } from '../components/layout/BottomNav';
import { FloatingActionButton } from '../components/layout/FloatingActionButton';
import { CalendarView } from '../components/calendar/CalendarView';
import { EventForm } from '../components/calendar/EventForm';
import { addCalendarEvent } from '../lib/db';

export const Home: React.FC = () => {
    const { user } = useAuth();
    const [items, setItems] = useState<Item[]>([]);
    const [monthlyBudget, setMonthlyBudget] = useState<number>(0);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isEventFormOpen, setIsEventFormOpen] = useState(false);
    const [selectedEventDate, setSelectedEventDate] = useState<Date | undefined>(undefined);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Item | null>(null);
    const [currentView, setCurrentView] = useState<'my-wishlist' | 'calendar' | 'friends' | 'groups' | 'settings'>('my-wishlist');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [monthlyBudgetsMap, setMonthlyBudgetsMap] = useState<Record<string, number>>({});


    // Search & Filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [filterObtained, setFilterObtained] = useState<'all' | 'not_obtained' | 'obtained'>('not_obtained');
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'priority'>('newest');

    // Share state
    const [copySuccess, setCopySuccess] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const loadItems = async () => {
        const data = await getItems();
        setItems(data);
    };

    const loadProfileData = async () => {
        if (user) {
            const { getMonthlyBudget } = await import('../lib/db');
            
            // Set current month string
            const now = new Date();
            const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            
            const budget = await getMonthlyBudget(currentMonthStr);
            if (budget > 0) {
                setMonthlyBudget(budget);
            } else {
                setMonthlyBudget(0);
            }
        }
    };

    useEffect(() => {
        if (currentView === 'my-wishlist') {
            loadItems();
            loadProfileData();
        }
    }, [currentView, user]);

    useEffect(() => {
        // URLからの共有データ復元処理
        const sharedData = parseSharedItemsFromUrl();
        if (sharedData && sharedData.length > 0) {
            if (confirm(`共有された ${sharedData.length} 件のアイテムがあります。自分のリストに追加しますか？`)) {
                const importItems = sharedData.map((item: any) => ({
                    ...item,
                    id: uuidv4(), // IDが衝突しないよう新しく振る
                    createdAt: Date.now(),
                    obtained: false // 初期化
                } as Item));

                addMultipleItems(importItems).then(() => {
                    window.location.hash = ''; // ハッシュをクリア
                    loadItems();
                    alert('追加が完了しました。');
                });
            } else {
                window.location.hash = ''; // キャンセルしてもハッシュをクリア
            }
        }
    }, []);

    const handleSaveItem = async (item: Item) => {
        if (editingItem) {
            await updateItem(item);
        } else {
            await addItem(item);
        }
        await loadItems();
    };

    const handleToggleObtained = async (id: string, currentStatus: boolean) => {
        const item = items.find(i => i.id === id);
        if (item) {
            const updatedItem = { ...item, obtained: !currentStatus, obtainedAt: !currentStatus ? Date.now() : undefined };
            await updateItem(updatedItem);
            await loadItems();
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('本当に削除しますか？')) {
            await deleteItem(id);
            setIsFormOpen(false);
            setEditingItem(null);
            await loadItems();
        }
    };

    const handleShareLink = () => {
        if (items.length === 0) return alert('共有するアイテムがありません。');
        const link = generateShareLink(items);
        navigator.clipboard.writeText(link).then(() => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        });
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const imported = await importDataFromJsonFile(file);
            if (confirm(`${imported.length}件のアイテムをインポートします（既存のリストに追加されます）。よろしいですか？\n※既存と同IDのものは上書きされます。`)) {
                await addMultipleItems(imported);
                await loadItems();
                alert('インポートが完了しました。');
            }
        } catch (err) {
            alert('ファイルの読み込みに失敗しました。対応していないフォーマットです。');
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Filter & Sort logic
    const displayedItems = useMemo(() => {
        let result = [...items];

        // Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(i =>
                i.title.toLowerCase().includes(q) ||
                (i.memo && i.memo.toLowerCase().includes(q))
            );
        }

        // Category Filter
        if (selectedCategory !== 'all') {
            result = result.filter(i => i.category === selectedCategory);
        }

        // Filter
        if (filterObtained === 'not_obtained') {
            result = result.filter(i => !i.obtained);
        } else if (filterObtained === 'obtained') {
            result = result.filter(i => i.obtained);
        }

        // Sort
        result.sort((a, b) => {
            // Always put obtained items at the bottom
            if (a.obtained !== b.obtained) {
                return a.obtained ? 1 : -1;
            }

            if (sortOrder === 'newest') return b.createdAt - a.createdAt;
            if (sortOrder === 'oldest') return a.createdAt - b.createdAt;
            if (sortOrder === 'priority') {
                const pValues = { high: 3, mid: 2, low: 1 };
                const pa = pValues[a.priority || 'mid'];
                const pb = pValues[b.priority || 'mid'];
                if (pa !== pb) return pb - pa;
                return b.createdAt - a.createdAt; // Fallback to newest
            }
            return 0;
        });

        return result;
    }, [items, searchQuery, selectedCategory, filterObtained, sortOrder]);

    useEffect(() => {
        // Fetch budget map for obtained view
        if (filterObtained === 'obtained' && displayedItems.length > 0) {
            const monthsToFetch = Array.from(new Set(displayedItems.filter(i => i.obtained).map(item => {
                const date = new Date(item.obtainedAt || item.createdAt);
                return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            })));
            
            if (monthsToFetch.length > 0) {
                 import('../lib/db').then(({ getMonthlyBudgets }) => {
                     getMonthlyBudgets(monthsToFetch).then(setMonthlyBudgetsMap);
                 });
            }
        }
    }, [displayedItems, filterObtained]);

    const totalSpent = useMemo(() => {
        return items
            .filter(i => i.obtained)
            .reduce((sum, item) => sum + parsePriceString(item.price), 0);
    }, [items]);

    const totalWishlistAmount = useMemo(() => {
        return items
            .filter(i => !i.obtained)
            .reduce((sum, item) => sum + parsePriceString(item.price), 0);
    }, [items]);

    const categories = useMemo(() => {
        const cats = items.map(i => i.category).filter((c): c is string => !!c && c.trim() !== '');
        return ['all', ...Array.from(new Set(cats))];
    }, [items]);

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem 100px 1rem' }}>

            {/* Main Content Areas */}
            {currentView === 'calendar' && (
                <>
                    <CalendarView 
                        onOpenEventForm={(date) => {
                            setSelectedEventDate(date);
                            setIsEventFormOpen(true);
                        }} 
                        onItemClick={(item) => {
                            setEditingItem(item);
                            setIsFormOpen(true);
                        }}
                    />

                    <div style={{ marginTop: '2rem' }}>
                        <MonthlyExpenseChart items={items} />
                        {totalSpent > 0 && (
                            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.05)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>入手済みの総支出額:</span>
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
                    {/* Header Area */}
                    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <h1 className="text-gradient" style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                                Wishlist
                            </h1>
                            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>欲しいものリストを管理</p>
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

                    {/* Control Panel (Search, Filter, Sort) */}
                    <div className="glass-panel" style={{ padding: '1rem', marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ flex: '1 1 300px' }}>
                            <Input
                                placeholder="タイトルやメモで検索..."
                                icon={<Search size={18} />}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <div className="input-wrapper" style={{ minWidth: '120px' }}>
                                <select className="input-field" value={sortOrder} onChange={e => setSortOrder(e.target.value as any)}>
                                    <option value="newest">新しい順</option>
                                    <option value="oldest">古い順</option>
                                    <option value="priority">優先度 (高→低)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Main Tabs (Not Obtained / Obtained) */}
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
                            入手済み（履歴）
                        </button>
                    </div>

                    {/* Category Filter Pills */}
                    {categories.length > 1 && (
                        <div style={{
                            display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '1.5rem',
                            scrollbarWidth: 'none', msOverflowStyle: 'none'
                        }} className="hide-scroll">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    style={{
                                        padding: '0.4rem 1.2rem',
                                        borderRadius: '99px',
                                        background: selectedCategory === cat ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                                        color: selectedCategory === cat ? 'white' : 'var(--text-secondary)',
                                        border: '1px solid ' + (selectedCategory === cat ? 'var(--primary)' : 'var(--glass-border)'),
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        fontSize: '0.875rem',
                                        transition: 'all 0.2s ease',
                                        fontWeight: selectedCategory === cat ? 600 : 400
                                    }}
                                >
                                    {cat === 'all' ? 'すべて' : cat}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Budget Overview Panel (Only shown in NOT OBTAINED view) */}
                    {filterObtained === 'not_obtained' && (
                        <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <div>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'block', marginBottom: '0.25rem' }}>リストの合計金額</span>
                                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.02em', lineHeight: 1 }}>{formatPrice(totalWishlistAmount)}</span>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>今月の予算</span>
                                    {monthlyBudget > 0 ? (
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                            <span style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{formatPrice(monthlyBudget)}</span>
                                            <button 
                                                onClick={() => setCurrentView('settings')}
                                                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                                            >
                                                変更
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                            <span style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-muted)' }}>— 円</span>
                                            <button 
                                                onClick={() => setCurrentView('settings')}
                                                style={{ background: 'none', border: '1px solid var(--primary)', borderRadius: '99px', padding: '0.25rem 0.75rem', color: 'var(--primary)', fontSize: '0.75rem', cursor: 'pointer' }}
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
                                    予算を {formatPrice(totalWishlistAmount - monthlyBudget)} オーバーしています
                                </p>
                            )}
                        </div>
                    )}

                    {/* Items Grid */}
                    {displayedItems.length > 0 ? (
                        filterObtained === 'obtained' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                                {(() => {
                                    const grouped = displayedItems.reduce((acc, item) => {
                                        const date = new Date(item.obtainedAt || item.createdAt);
                                        const monthKey = `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月`;
                                        if (!acc[monthKey]) acc[monthKey] = [];
                                        acc[monthKey].push(item);
                                        return acc;
                                    }, {} as Record<string, typeof displayedItems>);

                                    return Object.keys(grouped)
                                        .sort((a, b) => b.localeCompare(a)) // Descending order of months
                                        .map(month => {
                                            const itemsInMonth = grouped[month];
                                            const monthTotal = itemsInMonth.reduce((sum, item) => sum + parsePriceString(item.price), 0);
                                            const match = month.match(/(\d+)年(\d+)月/);
                                            const monthRaw = match ? `${match[1]}-${match[2]}` : '';
                                            const budgetForMonth = monthlyBudgetsMap[monthRaw] || 0;

                                            return (
                                                <div key={month}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                        <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>{month}</h2>
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
                                                    <div style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
                                                        gap: '1rem'
                                                    }}>
                                                        {itemsInMonth.map(item => (
                                                            <ItemCard
                                                                key={item.id}
                                                                item={item}
                                                                currentUserId={user?.id}
                                                                onReserve={async () => { }}
                                                                onCancelReservation={async () => { }}
                                                                onToggleObtained={handleToggleObtained}
                                                                onClick={(item) => {
                                                                    setEditingItem(item);
                                                                    setIsFormOpen(true);
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        });
                                })()}
                            </div>
                        ) : (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
                                gap: '1rem'
                            }}>
                                {displayedItems.map(item => (
                                    <ItemCard
                                        key={item.id}
                                        item={item}
                                        currentUserId={user?.id}
                                        onReserve={async () => { }}
                                        onCancelReservation={async () => { }}
                                        onToggleObtained={handleToggleObtained}
                                        onClick={(item) => {
                                            setEditingItem(item);
                                            setIsFormOpen(true);
                                        }}
                                    />
                                ))}
                            </div>
                        )
                    ) : (
                        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
                            <p style={{ fontSize: '1.125rem' }}>アイテムが見つかりません</p>
                            <button className="btn btn-ghost" onClick={() => { setEditingItem(null); setIsFormOpen(true); }} style={{ marginTop: '1rem' }}>
                                + 最初のアイテムを追加する
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Global Modals & Components */}
            <ItemForm
                isOpen={isFormOpen}
                onClose={() => { setIsFormOpen(false); setEditingItem(null); }}
                onSave={handleSaveItem}
                onDelete={handleDelete}
                initialData={editingItem}
            />

            <EventForm 
                isOpen={isEventFormOpen} 
                onClose={() => setIsEventFormOpen(false)} 
                onSave={async (eventData) => {
                    await addCalendarEvent(eventData);
                    // 雑ですが再レンダリングを促すためviewを切り替えて戻すか、Calendar内部でフェッチさせる
                    const prevView = currentView;
                    setCurrentView('my-wishlist');
                    setTimeout(() => setCurrentView(prevView), 10);
                }}
                initialDate={selectedEventDate}
            />

            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
            />

            <FloatingActionButton 
                onClick={() => { setEditingItem(null); setIsFormOpen(true); }} 
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

    return (
        <div style={{ position: 'relative' }}>
            <Button variant="secondary" onClick={() => setIsOpen(!isOpen)} icon={<Share2 size={18} />}>
                連携
            </Button>
            {isOpen && (
                <div className="glass-panel" style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    zIndex: 100,
                    marginTop: '0.5rem',
                    minWidth: '150px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}>
                    <button className="btn btn-ghost" style={{ padding: '0.75rem 1rem', justifyContent: 'flex-start' }} onClick={() => { onShare(); setIsOpen(false); }}>
                        {copySuccess ? <Check size={16} /> : <Share2 size={16} />} {copySuccess ? 'コピー済' : 'リンク共有'}
                    </button>
                    <button className="btn btn-ghost" style={{ padding: '0.75rem 1rem', justifyContent: 'flex-start' }} onClick={() => { onImportClick(); setIsOpen(false); }}>
                        <Upload size={16} /> インポート
                    </button>
                </div>
            )}
        </div>
    );
}
