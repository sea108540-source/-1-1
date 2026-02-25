import React, { useState, useEffect, useMemo } from 'react';
import { getItems, addItem, updateItem, deleteItem, addMultipleItems } from '../lib/db';
import type { Item } from '../lib/types';
import { generateShareLink, parseSharedItemsFromUrl, exportDataAsJsonFile, importDataFromJsonFile } from '../lib/shareUtils';
import { ItemCard } from '../components/ItemCard';
import { ItemForm } from '../components/ItemForm';
import { AuthModal } from '../components/AuthModal';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Plus, Search, Share2, Download, Upload, Check, User as UserIcon, LogOut, Users } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { FriendManager } from '../components/friends/FriendManager';

export const Home: React.FC = () => {
    const { user, loading: authLoading } = useAuth();
    const [items, setItems] = useState<Item[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Item | null>(null);
    const [currentView, setCurrentView] = useState<'my-wishlist' | 'friends'>('my-wishlist');

    // Search & Filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [filterObtained, setFilterObtained] = useState<'all' | 'not_obtained' | 'obtained'>('all');
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

    const handleExport = () => {
        if (items.length === 0) return alert('エクスポートするアイテムがありません。');
        exportDataAsJsonFile(items);
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

    const handleLogout = async () => {
        await supabase.auth.signOut();
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
    }, [items, searchQuery, filterObtained, sortOrder]);

    if (currentView === 'friends') {
        return (
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
                <FriendManager onBack={() => setCurrentView('my-wishlist')} />
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

                    {/* Friends Button - Always visible */}
                    <Button
                        variant="secondary"
                        icon={<Users size={18} />}
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
                            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <UserIcon size={14} />
                                <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {user.email}
                                </span>
                            </span>
                            <Button variant="ghost" size="sm" onClick={handleLogout} title="ログアウト">
                                <LogOut size={16} />
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
                        onExport={handleExport}
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

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
                    <div className="input-wrapper" style={{ flex: '1 1 auto', minWidth: '120px' }}>
                        <select className="input-field" value={filterObtained} onChange={e => setFilterObtained(e.target.value as any)}>
                            <option value="all">すべて</option>
                            <option value="not_obtained">未入手のみ</option>
                            <option value="obtained">入手済みのみ</option>
                        </select>
                    </div>
                    <div className="input-wrapper" style={{ flex: '1 1 auto', minWidth: '120px' }}>
                        <select className="input-field" value={sortOrder} onChange={e => setSortOrder(e.target.value as any)}>
                            <option value="newest">新しい順</option>
                            <option value="oldest">古い順</option>
                            <option value="priority">優先度 (高→低)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Items Grid */}
            {displayedItems.length > 0 ? (
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
    onExport: () => void;
    onImportClick: () => void;
}

const DropdownActionButtons: React.FC<DropdownActionButtonsProps> = ({ onShare, copySuccess, onExport, onImportClick }) => {
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
                    <button className="btn btn-ghost" style={{ padding: '0.75rem 1rem', justifyContent: 'flex-start' }} onClick={() => { onExport(); setIsOpen(false); }}>
                        <Download size={16} /> エクスポート
                    </button>
                    <button className="btn btn-ghost" style={{ padding: '0.75rem 1rem', justifyContent: 'flex-start' }} onClick={() => { onImportClick(); setIsOpen(false); }}>
                        <Upload size={16} /> インポート
                    </button>
                </div>
            )}
        </div>
    );
}
