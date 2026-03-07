import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { getGroupItems, addItem, updateItem, deleteItem, reserveItem, cancelReservation } from '../../lib/db';
import type { Item, Group } from '../../lib/types';
import { useAuth } from '../../contexts/AuthContext';
import { ItemCard } from '../ItemCard';
import { ItemForm } from '../ItemForm';
import { ArrowLeft, Plus } from 'lucide-react';

interface GroupWishlistProps {
    group: Group;
    onBack: () => void;
}

export const GroupWishlist: React.FC<GroupWishlistProps> = ({ group, onBack }) => {
    const { user } = useAuth();
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Item | null>(null);

    const loadItems = async () => {
        setLoading(true);
        const data = await getGroupItems(group.id);
        setItems(data);
        setLoading(false);
    };

    useEffect(() => {
        loadItems();
    }, [group.id]);

    const handleSaveItem = async (item: Item) => {
        if (editingItem) {
            await updateItem(item);
        } else {
            // addItem automatically handles inserting new item to DB
            await addItem(item);
        }
        await loadItems();
    };

    const handleDelete = async (id: string) => {
        if (confirm('本当に削除しますか？')) {
            await deleteItem(id);
            setIsFormOpen(false);
            setEditingItem(null);
            await loadItems();
        }
    };

    const handleToggleObtained = async (id: string, currentStatus: boolean) => {
        const item = items.find(i => i.id === id);
        if (item) {
            const updatedItem = { ...item, obtained: !currentStatus, obtainedAt: !currentStatus ? Date.now() : undefined };
            await updateItem(updatedItem);
            await loadItems();
        }
    };

    const handleReserve = async (id: string) => {
        try {
            await reserveItem(id);
            await loadItems();
        } catch (err) {
            console.error(err);
            alert('予約に失敗しました。');
        }
    };

    const handleCancelReservation = async (id: string) => {
        try {
            await cancelReservation(id);
            await loadItems();
        } catch (err) {
            console.error(err);
            alert('予約のキャンセルに失敗しました。');
        }
    };

    return (
        <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
                <Button variant="ghost" onClick={onBack} style={{ marginRight: '1rem' }}>
                    <ArrowLeft size={20} />
                </Button>
                <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: '1.5rem', margin: 0 }}>{group.name}</h2>
                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.875rem' }}>グループの欲しいものリスト</p>
                </div>
                <Button variant="primary" icon={<Plus size={18} />} onClick={() => { setEditingItem(null); setIsFormOpen(true); }}>
                    追加
                </Button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>読み込み中...</div>
            ) : items.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                    {items.map(item => (
                        <ItemCard
                            key={item.id}
                            item={item}
                            currentUserId={user?.id}
                            onToggleObtained={handleToggleObtained}
                            onReserve={handleReserve}
                            onCancelReservation={handleCancelReservation}
                            onClick={(item) => {
                                // 自分のアイテム以外は編集フォームを開かせない (閲覧のみとする)
                                if (item.creator?.id !== user?.id) return;
                                setEditingItem(item);
                                setIsFormOpen(true);
                            }}
                        />
                    ))}
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
                    <p style={{ fontSize: '1.125rem' }}>アイテムがありません</p>
                    <Button variant="ghost" onClick={() => { setEditingItem(null); setIsFormOpen(true); }} style={{ marginTop: '1rem' }}>
                        + 最初のアイテムを追加する
                    </Button>
                </div>
            )}

            <ItemForm
                isOpen={isFormOpen}
                onClose={() => { setIsFormOpen(false); setEditingItem(null); }}
                onSave={handleSaveItem}
                onDelete={handleDelete}
                initialData={editingItem}
                groupId={group.id}
            />
        </div>
    );
};
