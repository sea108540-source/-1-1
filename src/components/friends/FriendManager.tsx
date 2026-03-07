import React, { useState, useEffect } from 'react';
import { getFriends, addFriend, searchUserByUsername, getFriendItems, getProfile, updateProfile } from '../../lib/db';
import type { Profile, Item } from '../../lib/types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { UserPlus, Users, ArrowLeft, Search, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ItemCard } from '../ItemCard';

interface FriendManagerProps {
    onBack: () => void;
}

export const FriendManager: React.FC<FriendManagerProps> = ({ onBack }) => {
    const { user } = useAuth();
    const [friends, setFriends] = useState<Profile[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [foundUser, setFoundUser] = useState<Profile | null>(null);
    const [selectedFriend, setSelectedFriend] = useState<Profile | null>(null);
    const [friendItems, setFriendItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(false);
    const [myProfile, setMyProfile] = useState<Profile | null>(null);
    const [isSettingId, setIsSettingId] = useState(false);
    const [newUsername, setNewUsername] = useState('');

    useEffect(() => {
        loadFriends();
        if (user) loadMyProfile();
    }, [user]);

    const loadFriends = async () => {
        const data = await getFriends();
        setFriends(data);
    };

    const loadMyProfile = async () => {
        if (!user) return;
        const profile = await getProfile(user.id);
        setMyProfile(profile);
        if (profile) setNewUsername(profile.username || '');
    };

    const handleSearch = async () => {
        if (!searchQuery) return;
        setLoading(true);
        const result = await searchUserByUsername(searchQuery);
        setFoundUser(result);
        setLoading(false);
    };

    const handleAddFriend = async () => {
        if (!foundUser) return;
        try {
            await addFriend(foundUser.id);
            alert(`${foundUser.display_name || foundUser.username} を友達に追加しました！`);
            setFoundUser(null);
            setSearchQuery('');
            loadFriends();
        } catch (err) {
            alert('友達の追加に失敗しました。既に追加されているか、自分自身を追加しようとしている可能性があります。');
        }
    };

    const handleSelectFriend = async (friend: Profile) => {
        setSelectedFriend(friend);
        const items = await getFriendItems(friend.id);
        setFriendItems(items);
    };

    const handleUpdateProfile = async () => {
        if (!user || !newUsername) return;
        try {
            await updateProfile({
                id: user.id,
                username: newUsername,
                display_name: myProfile?.display_name || user.email?.split('@')[0] || 'User',
                updated_at: new Date().toISOString() as any
            });
            setIsSettingId(false);
            loadMyProfile();
            alert('IDを設定しました！このIDを友達に教えてください。');
        } catch (err: any) {
            console.error('Profile update failed:', err);
            alert(`エラーが発生しました: ${err.message || '不明なエラー'}\n(このIDは既に使われている可能性があります)`);
        }
    };


    if (selectedFriend) {
        return (
            <div className="friend-wishlist-view">
                {/* 戻るボタン */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <Button variant="ghost" icon={<ArrowLeft size={18} />} onClick={() => setSelectedFriend(null)}>戻る</Button>
                </div>

                {/* Instagramライクなプロフィールカード */}
                <div className="glass-panel" style={{ padding: '1.5rem 2rem', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        {/* アバター */}
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
                                <div style={{
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
                                }}>
                                    {(selectedFriend.display_name || selectedFriend.username || '?')[0].toUpperCase()}
                                </div>
                            )}
                        </div>

                        {/* 名前・ID・自己紹介 */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: '0 0 0.15rem 0', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {selectedFriend.display_name || selectedFriend.username}
                            </p>
                            <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                @{selectedFriend.username}
                            </p>
                            {selectedFriend.bio && (
                                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                    {selectedFriend.bio}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* アイテムリスト */}
                {friendItems.length > 0 ? (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: '1rem'
                    }}>
                        {friendItems.map(item => (
                            <ItemCard
                                key={item.id}
                                item={item}
                                onToggleObtained={() => { }} // 友達のリストは変更不可
                                onClick={() => { }} // とりあえずviewだけ
                            />
                        ))}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
                        <p>アイテムがありません</p>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="friend-manager">
            <header style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <Button variant="ghost" icon={<ArrowLeft size={18} />} onClick={onBack}>戻る</Button>
                <h2 style={{ margin: 0 }}>友達を探す・管理</h2>
            </header>

            {/* My Profile / ID Setting */}
            <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>自分のマイID</h3>
                        {myProfile?.username ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>@{myProfile.username}</span>
                                <Button variant="ghost" size="sm" onClick={() => setIsSettingId(true)}>変更</Button>
                            </div>
                        ) : (
                            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>IDが設定されていません</p>
                        )}
                    </div>
                    {!myProfile?.username && (
                        <Button variant="primary" size="sm" onClick={() => setIsSettingId(true)}>IDを設定する</Button>
                    )}
                </div>

                {isSettingId && (
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                        <Input
                            placeholder="英数字でIDを入力..."
                            value={newUsername}
                            onChange={e => setNewUsername(e.target.value)}
                        />
                        <Button variant="primary" onClick={handleUpdateProfile}>保存</Button>
                        <Button variant="ghost" onClick={() => setIsSettingId(false)}>キャンセル</Button>
                    </div>
                )}
            </div>

            {/* Search Friends */}
            <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>友達をIDで検索</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Input
                        placeholder="友達のID (例: friend123)"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        icon={<Search size={18} />}
                    />
                    <Button variant="secondary" onClick={handleSearch} disabled={loading}>検索</Button>
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
                        <Button variant="primary" size="sm" icon={<UserPlus size={16} />} onClick={handleAddFriend}>友達追加</Button>
                    </div>
                )}
                {searchQuery && !loading && !foundUser && foundUser !== null && (
                    <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--danger)' }}>ユーザーが見つかりませんでした。</p>
                )}
            </div>

            {/* Friend List */}
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
                        <p>まだ友達がいません。IDを教えてもらって追加しましょう！</p>
                    </div>
                )}
            </div>
        </div>
    );
};
