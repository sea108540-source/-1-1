import React, { useCallback, useEffect, useState } from 'react';
import {
    addFriend,
    deleteItem,
    getFriendItems,
    getFriends,
    getProfile,
    searchUserByUsername,
    updateItem,
    updateProfile,
} from '../../lib/db';
import type { FriendRequest, Item, Profile } from '../../lib/types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { UserPlus, Users, ArrowLeft, Search, User as UserIcon, Cake, Check, X, QrCode, Download } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useAuth } from '../../contexts/AuthContext';
import { ItemCard } from '../ItemCard';
import { ItemForm } from '../ItemForm';

interface FriendManagerProps {
    onBack: () => void;
}

export const FriendManager: React.FC<FriendManagerProps> = ({ onBack }) => {
    const { user } = useAuth();
    const [friends, setFriends] = useState<Profile[]>([]);
    const [requests, setRequests] = useState<FriendRequest[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [foundUser, setFoundUser] = useState<Profile | null>(null);
    const [selectedFriend, setSelectedFriend] = useState<Profile | null>(null);
    const [friendItems, setFriendItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(false);
    const [myProfile, setMyProfile] = useState<Profile | null>(null);
    const [isSettingId, setIsSettingId] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [showQRModal, setShowQRModal] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Item | null>(null);

    const loadFriends = useCallback(async () => {
        const data = await getFriends();
        setFriends(data);
    }, []);

    const loadRequests = useCallback(async () => {
        const { getFriendRequests } = await import('../../lib/db');
        const reqData = await getFriendRequests();
        setRequests(reqData);
    }, []);

    const loadMyProfile = useCallback(async () => {
        if (!user) return;

        const profile = await getProfile(user.id);
        setMyProfile(profile);
        if (profile) {
            setNewUsername(profile.username || '');
        }
    }, [user]);

    useEffect(() => {
        void loadFriends();
        void loadRequests();
        void loadMyProfile();
    }, [loadFriends, loadMyProfile, loadRequests]);

    const handleAcceptRequest = async (id: string) => {
        const { acceptFriendRequest } = await import('../../lib/db');
        await acceptFriendRequest(id);
        void loadRequests();
        void loadFriends();
    };

    const handleRejectRequest = async (id: string) => {
        const { rejectFriendRequest } = await import('../../lib/db');
        await rejectFriendRequest(id);
        void loadRequests();
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setLoading(true);
        try {
            const result = await searchUserByUsername(searchQuery.trim());
            setFoundUser(result);
        } finally {
            setLoading(false);
        }
    };

    const handleAddFriend = async () => {
        if (!foundUser) return;

        try {
            await addFriend(foundUser.id);
            alert(`${foundUser.display_name || foundUser.username} に友達リクエストを送信しました。`);
            setFoundUser(null);
            setSearchQuery('');
            void loadFriends();
            void loadRequests();
        } catch (err) {
            const message = err instanceof Error ? err.message : '不明なエラーが発生しました。';
            alert(`友達リクエストの送信に失敗しました。\n${message}`);
        }
    };

    const handleSelectFriend = async (friend: Profile) => {
        setSelectedFriend(friend);
        const items = await getFriendItems(friend.id);
        setFriendItems(items);
    };

    const handleUpdateProfile = async () => {
        if (!user || !newUsername.trim()) return;

        try {
            await updateProfile({
                id: user.id,
                username: newUsername.trim(),
                display_name: myProfile?.display_name || user.email?.split('@')[0] || 'User',
                updated_at: new Date().toISOString()
            });
            setIsSettingId(false);
            await loadMyProfile();
            alert('IDを更新しました。');
        } catch (err) {
            const message = err instanceof Error ? err.message : '不明なエラーが発生しました。';
            alert(`IDの更新に失敗しました。\n${message}`);
        }
    };

    const handleDownloadQR = () => {
        const canvas = document.getElementById('my-qr-code') as HTMLCanvasElement | null;
        if (!canvas) return;

        const pngUrl = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = `qr_${myProfile?.username || 'user'}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    };

    if (selectedFriend) {
        return (
            <div className="friend-wishlist-view">
                <div style={{ marginBottom: '1.5rem' }}>
                    <Button variant="ghost" icon={<ArrowLeft size={18} />} onClick={() => setSelectedFriend(null)}>
                        戻る
                    </Button>
                </div>

                <div className="glass-panel" style={{ padding: '1.5rem 2rem', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <div style={{ flexShrink: 0 }}>
                            {selectedFriend.avatar_url ? (
                                <img
                                    src={selectedFriend.avatar_url}
                                    alt={selectedFriend.display_name || 'avatar'}
                                    style={{
                                        width: 80,
                                        height: 80,
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                        border: '2px solid var(--primary)',
                                    }}
                                />
                            ) : (
                                <div
                                    style={{
                                        width: 80,
                                        height: 80,
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, var(--primary), var(--accent-primary, #8b5cf6))',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '2rem',
                                        fontWeight: 'bold',
                                        color: 'white',
                                        border: '2px solid var(--primary)',
                                    }}
                                >
                                    {(selectedFriend.display_name || selectedFriend.username || '?')[0].toUpperCase()}
                                </div>
                            )}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: '0 0 0.15rem 0', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {selectedFriend.display_name || selectedFriend.username}
                            </p>
                            <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                @{selectedFriend.username}
                            </p>
                            {selectedFriend.bio && (
                                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                    {selectedFriend.bio}
                                </p>
                            )}
                            {selectedFriend.birthday && (() => {
                                const birthdayDate = new Date(selectedFriend.birthday);
                                const today = new Date();
                                const month = birthdayDate.getMonth() + 1;
                                const day = birthdayDate.getDate();
                                const isToday = today.getMonth() === birthdayDate.getMonth() && today.getDate() === birthdayDate.getDate();

                                return (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                        <Cake size={14} />
                                        <span>
                                            {month}月{day}日
                                            {isToday && <span style={{ marginLeft: '0.5rem', color: '#f59e0b', fontWeight: 700 }}>誕生日です</span>}
                                        </span>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>

                {friendItems.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                        {friendItems.map(item => (
                            <ItemCard
                                key={item.id}
                                item={item}
                                onToggleObtained={() => {}}
                                onClick={clickedItem => {
                                    setEditingItem(clickedItem);
                                    setIsFormOpen(true);
                                }}
                            />
                        ))}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
                        <p>アイテムがありません</p>
                    </div>
                )}

                <ItemForm
                    isOpen={isFormOpen}
                    onClose={() => {
                        setIsFormOpen(false);
                        setEditingItem(null);
                    }}
                    onSave={async item => {
                        await updateItem(item);
                        if (selectedFriend) {
                            const items = await getFriendItems(selectedFriend.id);
                            setFriendItems(items);
                        }
                    }}
                    onDelete={async id => {
                        if (!confirm('本当に削除しますか？')) return;

                        await deleteItem(id);
                        setIsFormOpen(false);
                        setEditingItem(null);
                        if (selectedFriend) {
                            const items = await getFriendItems(selectedFriend.id);
                            setFriendItems(items);
                        }
                    }}
                    initialData={editingItem}
                    readOnly={editingItem?.creator?.id !== user?.id}
                />
            </div>
        );
    }

    return (
        <div className="friend-manager">
            <header style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <Button variant="ghost" icon={<ArrowLeft size={18} />} onClick={onBack}>
                    戻る
                </Button>
                <h2 style={{ margin: 0 }}>友達を探す・管理する</h2>
            </header>

            <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>自分の公開ID</h3>
                        {myProfile?.username ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>@{myProfile.username}</span>
                                <Button variant="secondary" size="sm" icon={<QrCode size={16} />} onClick={() => setShowQRModal(true)}>
                                    QRコード
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setIsSettingId(true)}>
                                    編集
                                </Button>
                            </div>
                        ) : (
                            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>IDがまだ設定されていません</p>
                        )}
                    </div>
                    {!myProfile?.username && (
                        <Button variant="primary" size="sm" onClick={() => setIsSettingId(true)}>
                            IDを設定する
                        </Button>
                    )}
                </div>

                {isSettingId && (
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                        <Input
                            placeholder="英数字でIDを入力"
                            value={newUsername}
                            onChange={e => setNewUsername(e.target.value)}
                        />
                        <Button variant="primary" onClick={handleUpdateProfile}>
                            保存
                        </Button>
                        <Button variant="ghost" onClick={() => setIsSettingId(false)}>
                            キャンセル
                        </Button>
                    </div>
                )}
            </div>

            {showQRModal && myProfile?.username && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 100,
                        padding: '1rem'
                    }}
                    onClick={() => setShowQRModal(false)}
                >
                    <div
                        style={{
                            background: 'var(--bg-card)',
                            padding: '2rem',
                            borderRadius: 'var(--radius-lg)',
                            textAlign: 'center',
                            maxWidth: '350px',
                            width: '100%',
                            border: '1px solid var(--glass-border)',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', color: 'var(--text-primary)' }}>あなたのQRコード</h3>
                        <div
                            style={{
                                background: 'white',
                                padding: '1rem',
                                borderRadius: 'var(--radius-md)',
                                display: 'inline-block',
                                marginBottom: '1.5rem'
                            }}
                        >
                            <QRCodeCanvas
                                id="my-qr-code"
                                value={`${window.location.origin}/p/${myProfile.username}`}
                                size={200}
                                level="H"
                                fgColor="#000000"
                                bgColor="#ffffff"
                            />
                        </div>
                        <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                            このQRコードを読み取ってもらうと、公開プロフィールを開けます。
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <Button variant="primary" icon={<Download size={18} />} onClick={handleDownloadQR}>
                                画像として保存
                            </Button>
                            <Button variant="ghost" onClick={() => setShowQRModal(false)}>
                                閉じる
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {requests.length > 0 && (
                <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', border: '1px solid var(--primary)' }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                            style={{
                                background: 'var(--primary)',
                                color: 'white',
                                borderRadius: '50%',
                                width: '20px',
                                height: '20px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.75rem',
                                fontWeight: 'bold'
                            }}
                        >
                            {requests.length}
                        </span>
                        届いている友達リクエスト
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {requests.map(req => (
                            <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ flexShrink: 0 }}>
                                        {req.sender?.avatar_url ? (
                                            <img src={req.sender.avatar_url} alt="avatar" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                                {(req.sender?.display_name || req.sender?.username || '?')[0].toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 'bold' }}>{req.sender?.display_name || req.sender?.username}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>@{req.sender?.username}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <Button variant="primary" size="sm" onClick={() => handleAcceptRequest(req.id)} icon={<Check size={16} />}>
                                        承認
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleRejectRequest(req.id)} icon={<X size={16} />} style={{ color: 'var(--text-muted)' }}>
                                        拒否
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>IDで友達を検索</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Input
                        placeholder="例: friend123"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        icon={<Search size={18} />}
                    />
                    <Button variant="secondary" onClick={handleSearch} disabled={loading}>
                        検索
                    </Button>
                </div>

                {foundUser && (
                    <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <UserIcon size={20} />
                            </div>
                            <div>
                                <div style={{ fontWeight: 'bold' }}>{foundUser.display_name || foundUser.username}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>@{foundUser.username}</div>
                            </div>
                        </div>
                        <Button variant="primary" size="sm" icon={<UserPlus size={16} />} onClick={handleAddFriend}>
                            リクエスト送信
                        </Button>
                    </div>
                )}
                {searchQuery && !loading && !foundUser && foundUser !== null && (
                    <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--danger)' }}>ユーザーが見つかりませんでした。</p>
                )}
            </div>

            <div>
                <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
                    <Users size={20} /> 友達リスト
                </h3>
                {friends.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {friends.map(friend => (
                            <div
                                key={friend.id}
                                className="glass-panel"
                                style={{ padding: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'transform 0.2s' }}
                                onClick={() => handleSelectFriend(friend)}
                            >
                                <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <UserIcon size={24} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 'bold' }}>{friend.display_name || friend.username}</div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>@{friend.username}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <p>まだ友達がいません。ID検索から追加できます。</p>
                    </div>
                )}
            </div>
        </div>
    );
};
