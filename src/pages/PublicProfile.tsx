import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Cake, Check, LogIn, UserPlus } from 'lucide-react';
import { searchUserByUsername, getPublicProfileItems, reserveItem, cancelReservation } from '../lib/db';
import type { Item, Profile } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { ItemCard } from '../components/ItemCard';
import { ItemForm } from '../components/ItemForm';

interface PublicProfileProps {
    username: string;
}

export const PublicProfile: React.FC<PublicProfileProps> = ({ username }) => {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterObtained, setFilterObtained] = useState<'unobtained' | 'obtained'>('unobtained');
    const [friendStatus, setFriendStatus] = useState<'none' | 'pending' | 'friends'>('none');
    const [requesting, setRequesting] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const { user } = useAuth();

    const reloadItems = useCallback(async (userId: string) => {
        try {
            const userItems = await getPublicProfileItems(userId, user?.id);
            setItems(userItems);
        } catch (error) {
            console.error(error);
        }
    }, [user?.id]);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!username) return;

            setLoading(true);
            setFriendStatus('none');

            try {
                const foundProfile = await searchUserByUsername(username);

                if (!foundProfile) {
                    setProfile(null);
                    setItems([]);
                    return;
                }

                setProfile(foundProfile);
                await reloadItems(foundProfile.id);

                if (user && user.id !== foundProfile.id) {
                    try {
                        const { getFriends } = await import('../lib/db');
                        const friendsList = await getFriends();

                        if (friendsList.find(friend => friend.id === foundProfile.id)) {
                            setFriendStatus('friends');
                        } else {
                            const { supabase } = await import('../lib/supabase');
                            const { data: existing } = await supabase
                                .from('friendships')
                                .select('status')
                                .eq('user_id', user.id)
                                .eq('friend_id', foundProfile.id)
                                .single();

                            if (existing?.status === 'pending') {
                                setFriendStatus('pending');
                            }
                        }
                    } catch (error) {
                        console.error('Error checking friend status', error);
                    }
                }
            } catch (error) {
                console.error('Failed to load profile', error);
                setProfile(null);
                setItems([]);
            } finally {
                setLoading(false);
            }
        };

        void fetchProfile();
    }, [username, user, reloadItems]);

    const handleReserve = async (id: string) => {
        try {
            await reserveItem(id);
            if (profile) {
                await reloadItems(profile.id);
            }
        } catch (error) {
            console.error(error);
            window.alert('予約に失敗しました。');
        }
    };

    const handleCancelReservation = async (id: string) => {
        try {
            await cancelReservation(id);
            if (profile) {
                await reloadItems(profile.id);
            }
        } catch (error) {
            console.error(error);
            window.alert('予約解除に失敗しました。');
        }
    };

    const handleSendRequest = async () => {
        if (!profile || !user) return;

        setRequesting(true);
        try {
            const { addFriend } = await import('../lib/db');
            await addFriend(profile.id);
            setFriendStatus('pending');
            window.alert('フレンドリクエストを送信しました。');
        } catch (error) {
            const message = error instanceof Error ? error.message : '予期しないエラーが発生しました。';
            window.alert(`フレンドリクエストの送信に失敗しました。\n${message}`);
        } finally {
            setRequesting(false);
        }
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: 'var(--text-muted)' }}>読み込み中...</p>
            </div>
        );
    }

    if (!profile) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem' }}>
                <h2 style={{ color: 'var(--text-primary)' }}>ユーザーが見つかりません</h2>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>URL が正しいか確認してください。</p>
                <button
                    onClick={() => {
                        window.location.href = '/';
                    }}
                    style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--primary)',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 600
                    }}
                >
                    トップページへ戻る
                </button>
            </div>
        );
    }

    const filteredItems = items.filter(item => filterObtained === 'obtained' ? item.obtained : !item.obtained);
    const isOwnProfile = user?.id === profile.id;

    return (
        <div
            style={{
                maxWidth: '1200px',
                margin: '0 auto',
                padding: '2rem',
                paddingBottom: '6rem'
            }}
        >
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <button
                    onClick={() => {
                        window.location.href = '/';
                    }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '0.5rem',
                        fontSize: '0.9rem'
                    }}
                >
                    <ArrowLeft size={18} />
                    ホームへ戻る
                </button>
            </header>

            <div className="glass-panel" style={{ padding: '1.5rem 2rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ flexShrink: 0 }}>
                        {profile.avatar_url ? (
                            <img
                                src={profile.avatar_url}
                                alt={profile.display_name || 'avatar'}
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
                                {(profile.display_name || profile.username || '?')[0].toUpperCase()}
                            </div>
                        )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: '0 0 0.15rem 0', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {profile.display_name || profile.username}
                        </p>
                        <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                            @{profile.username}
                        </p>
                        {profile.bio && (
                            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                {profile.bio}
                            </p>
                        )}
                        {profile.birthday && (() => {
                            const birthdayDate = new Date(profile.birthday);
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

                        <div style={{ marginTop: '1rem' }}>
                            {!user ? (
                                <Button variant="secondary" size="sm" icon={<LogIn size={16} />} onClick={() => { window.location.href = '/'; }}>
                                    ログインして使う
                                </Button>
                            ) : isOwnProfile ? (
                                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-full)' }}>
                                    あなた自身の公開プロフィールです
                                </span>
                            ) : friendStatus === 'friends' ? (
                                <Button variant="ghost" size="sm" icon={<Check size={16} color="var(--primary)" />} disabled>
                                    フレンドです
                                </Button>
                            ) : friendStatus === 'pending' ? (
                                <Button variant="secondary" size="sm" disabled>
                                    リクエスト送信済み
                                </Button>
                            ) : (
                                <Button variant="primary" size="sm" icon={<UserPlus size={16} />} onClick={handleSendRequest} disabled={requesting}>
                                    {requesting ? '送信中...' : 'フレンド申請を送る'}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', flex: 1 }}>公開ウィッシュリスト</h2>
                <div
                    style={{
                        display: 'flex',
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '99px',
                        padding: '0.25rem',
                        border: '1px solid var(--glass-border)',
                    }}
                >
                    <button
                        onClick={() => setFilterObtained('unobtained')}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '99px',
                            background: filterObtained === 'unobtained' ? 'var(--primary)' : 'transparent',
                            color: filterObtained === 'unobtained' ? 'white' : 'var(--text-muted)',
                            border: 'none',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        欲しいもの ({items.filter(item => !item.obtained).length})
                    </button>
                    <button
                        onClick={() => setFilterObtained('obtained')}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '99px',
                            background: filterObtained === 'obtained' ? 'var(--primary)' : 'transparent',
                            color: filterObtained === 'obtained' ? 'white' : 'var(--text-muted)',
                            border: 'none',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        入手済み ({items.filter(item => item.obtained).length})
                    </button>
                </div>
            </div>

            {filteredItems.length > 0 ? (
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: '1rem'
                    }}
                >
                    {filteredItems.map(item => (
                        <ItemCard
                            key={item.id}
                            item={item}
                            currentUserId={user?.id}
                            onToggleObtained={() => undefined}
                            onReserve={handleReserve}
                            onCancelReservation={handleCancelReservation}
                            onClick={selected => {
                                setSelectedItem(selected);
                                setIsItemModalOpen(true);
                            }}
                        />
                    ))}
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
                    <p style={{ fontSize: '1.125rem' }}>
                        {filterObtained === 'obtained' ? '入手済みのアイテムはまだありません' : '公開中の欲しいものはまだありません'}
                    </p>
                </div>
            )}

            <ItemForm
                isOpen={isItemModalOpen}
                onClose={() => {
                    setIsItemModalOpen(false);
                    setSelectedItem(null);
                }}
                onSave={() => undefined}
                initialData={selectedItem}
                readOnly
            />
        </div>
    );
};
