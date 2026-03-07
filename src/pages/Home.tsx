import React, { useState, useEffect, useMemo } from 'react';
import { getItems, addItem, updateItem, deleteItem, addMultipleItems } from '../lib/db';
import type { Item } from '../lib/types';
import { generateShareLink, parseSharedItemsFromUrl, importDataFromJsonFile } from '../lib/shareUtils';
import { ItemCard } from '../components/ItemCard';
import { ItemForm } from '../components/ItemForm';
import { parsePriceString } from '../lib/utils';
import { AuthModal } from '../components/AuthModal';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Plus, Search, Share2, Upload, Check, User as UserIcon, Users, Settings as SettingsIcon } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../contexts/AuthContext';
import { FriendManager } from '../components/friends/FriendManager';
import { GroupManager } from '../components/groups/GroupManager';
import { Settings } from './Settings';
import { MonthlyExpenseChart } from '../components/MonthlyExpenseChart';

export const Home: React.FC = () => {
    const { user, loading: authLoading } = useAuth();
    const [items, setItems] = useState<Item[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Item | null>(null);
    const [currentView, setCurrentView] = useState<'my-wishlist' | 'friends' | 'groups' | 'settings'>('my-wishlist');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

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

    useEffect(() => {
        loadItems();

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

    const totalSpent = useMemo(() => {
        return items
            .filter(i => i.obtained)
            .reduce((sum, item) => sum + parsePriceString(item.price), 0);
    }, [items]);

    const categories = useMemo(() => {
        const cats = items.map(i => i.category).filter((c): c is string => !!c && c.trim() !== '');
        return ['all', ...Array.from(new Set(cats))];
    }, [items]);

    if (currentView === 'friends') {
        return (
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
                <FriendManager onBack={() => setCurrentView('my-wishlist')} />
            </div>
        );
    }

    if (currentView === 'groups') {
        return (
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
                <GroupManager onBack={() => setCurrentView('my-wishlist')} />
            </div>
        );
    }

    if (currentView === 'settings') {
        return (
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
                <Settings onBack={() => setCurrentView('my-wishlist')} />
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>

            {/* Header Area */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 className="text-gradient" style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                        Wishlist
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', margin: 0 }}>欲しいものリストを管理・共有</p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>

                    {/* Groups Button */}
                    <Button
                        variant="secondary"
                        icon={<Users size={18} />}
                        onClick={() => {
                            if (user) {
                                setCurrentView('groups');
                            } else {
                                setIsAuthModalOpen(true);
                            }
                        }}
                    >
                        グループ
                    </Button>

                    {/* Friends Button - Always visible */}
                    <Button
                        variant="secondary"
                        icon={<UserIcon size={18} />}
                        onClick={() => {
                            if (user) {
                                setCurrentView('friends');
                            } else {
                                setIsAuthModalOpen(true);
                            }
                        }}
                    >
                        友達
                    </Button>

                    {/* Auth Display Area */}
                    {!authLoading && user ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: '0.5rem' }}>
                            <Button variant="ghost" size="sm" onClick={() => setCurrentView('settings')} title="設定">
                                <SettingsIcon size={20} />
                            </Button>
                        </div>
                    ) : (
                        <Button variant="secondary" size="md" onClick={() => setIsAuthModalOpen(true)} style={{ marginRight: '0.5rem' }}>
                            ログイン
                        </Button>
                    )}

                    {/* Action Buttons */}
                    <DropdownActionButtons
                        onShare={handleShareLink}
                        copySuccess={copySuccess}
                        onImportClick={() => fileInputRef.current?.click()}
                    />

                    <input type="file" accept=".json" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImport} />

                    <Button variant="primary" icon={<Plus size={18} />} onClick={() => { setEditingItem(null); setIsFormOpen(true); }} style={{ flex: '1 1 auto' }}>
                        追加
                    </Button>
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

            {filterObtained === 'obtained' && totalSpent > 0 && (
                <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.05)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>入手済みの総支出額:</span>
                    <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '1.25rem', letterSpacing: '0.02em' }}>
                        ¥{totalSpent.toLocaleString()}
                    </span>
                </div>
            )}

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

            {/* Items Grid */}
            {displayedItems.length > 0 ? (
                filterObtained === 'obtained' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                        <MonthlyExpenseChart items={displayedItems} />
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

                                    return (
                                        <div key={month}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
                                                <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>{month}</h2>
                                                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--primary)', letterSpacing: '0.02em' }}>
                                                    ¥{monthTotal.toLocaleString()}
                                                </div>
                                            </div>
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                                gap: '1rem'
                                            }}>
                                                {itemsInMonth.map(item => (
                                                    <ItemCard
                                                        key={item.id}
                                                        item={item}
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
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: '1rem'
                    }}>
                        {displayedItems.map(item => (
                            <ItemCard
                                key={item.id}
                                item={item}
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
                    <Button variant="ghost" onClick={() => { setEditingItem(null); setIsFormOpen(true); }} style={{ marginTop: '1rem' }}>
                        + 最初のアイテムを追加する
                    </Button>
                </div>
            )}

            {/* フォームモーダル */}
            <ItemForm
                isOpen={isFormOpen}
                onClose={() => { setIsFormOpen(false); setEditingItem(null); }}
                onSave={handleSaveItem}
                onDelete={handleDelete}
                initialData={editingItem}
            />

            {/* 認証モーダル */}
            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
            />

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
