import React, { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { getGroups, createGroup, getFriends, addGroupMember, getGroupMembers, searchUserByUsername } from '../../lib/db';
import type { Group, Profile } from '../../lib/types';
import { Users, Plus, ArrowLeft, UserPlus } from 'lucide-react';
import { useFeedback } from '../../contexts/FeedbackContext';
import { GroupWishlist } from './GroupWishlist';

interface GroupManagerProps {
    onBack: () => void;
}

export const GroupManager: React.FC<GroupManagerProps> = ({ onBack }) => {
    const { showToast } = useFeedback();
    const [groups, setGroups] = useState<Group[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
    const [loading, setLoading] = useState(true);
    const [newGroupName, setNewGroupName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [inviteGroupId, setInviteGroupId] = useState<string | null>(null);
    const [friends, setFriends] = useState<Profile[]>([]);
    const [groupMembers, setGroupMembers] = useState<Profile[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResult, setSearchResult] = useState<Profile | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    const loadGroups = async () => {
        setLoading(true);
        const data = await getGroups();
        setGroups(data);
        setLoading(false);
    };

    useEffect(() => {
        void loadGroups();
    }, []);

    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) return;

        try {
            await createGroup(newGroupName.trim());
            setNewGroupName('');
            setIsCreating(false);
            await loadGroups();
        } catch (err) {
            const message = err instanceof Error ? err.message : '不明なエラーが発生しました。';
            showToast({ type: 'error', message: `グループ作成に失敗しました: ${message}` });
        }
    };

    const handleOpenInvite = async (groupId: string) => {
        setInviteGroupId(groupId);
        setSearchQuery('');
        setSearchResult(null);
        const friendList = await getFriends();
        const members = await getGroupMembers(groupId);
        setFriends(friendList);
        setGroupMembers(members);
    };

    const handleInvite = async (userId: string) => {
        if (!inviteGroupId) return;

        try {
            await addGroupMember(inviteGroupId, userId);
            const members = await getGroupMembers(inviteGroupId);
            setGroupMembers(members);
            setSearchQuery('');
            setSearchResult(null);
            showToast({ type: 'success', message: 'メンバーを追加しました。' });
        } catch (err) {
            const message = err instanceof Error ? err.message : '不明なエラーが発生しました。';
            showToast({ type: 'error', message: `追加に失敗しました: ${message}` });
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        setSearchResult(null);
        try {
            const result = await searchUserByUsername(searchQuery.trim());
            setSearchResult(result);
            if (!result) {
                showToast({ type: 'info', message: '入力されたIDのユーザーが見つかりませんでした。' });
            }
        } catch (err) {
            console.error('Search error:', err);
        } finally {
            setIsSearching(false);
        }
    };

    if (selectedGroup) {
        return <GroupWishlist group={selectedGroup} onBack={() => setSelectedGroup(null)} />;
    }

    return (
        <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
                <Button variant="ghost" onClick={onBack} style={{ marginRight: '1rem' }}>
                    <ArrowLeft size={20} />
                </Button>
                <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: '1.5rem', margin: 0 }}>グループ</h2>
                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.875rem' }}>家族や仲間とリストを共有できます</p>
                </div>
                <Button variant="primary" icon={<Plus size={18} />} onClick={() => setIsCreating(!isCreating)}>
                    作成
                </Button>
            </div>

            {isCreating && (
                <div style={{ marginBottom: '2rem', display: 'flex', gap: '0.5rem' }}>
                    <Input
                        placeholder="グループ名を入力"
                        value={newGroupName}
                        onChange={e => setNewGroupName(e.target.value)}
                    />
                    <Button variant="primary" onClick={handleCreateGroup}>作成して保存</Button>
                </div>
            )}

            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>読み込み中...</div>
            ) : groups.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {groups.map(group => (
                        <div
                            key={group.id}
                            style={{
                                padding: '1rem',
                                borderRadius: '8px',
                                backgroundColor: 'white',
                                border: '1px solid rgba(0,0,0,0.05)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}
                        >
                            <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setSelectedGroup(group)}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Users size={18} className="text-secondary" />
                                    <h3 style={{ margin: 0, fontSize: '1.125rem' }}>{group.name}</h3>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" icon={<UserPlus size={16} />} onClick={() => handleOpenInvite(group.id)}>
                                招待
                            </Button>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.02)', marginBottom: '1rem' }}>
                        <Users size={32} style={{ opacity: 0.5 }} />
                    </div>
                    <p style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>まだ参加しているグループがありません</p>
                    <Button variant="secondary" onClick={() => setIsCreating(true)}>新しいグループを作成</Button>
                </div>
            )}

            {inviteGroupId && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        zIndex: 1000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <div className="glass-panel" style={{ padding: '2rem', width: '100%', maxWidth: '400px', backgroundColor: '#faf8f5', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>グループにメンバーを追加</h3>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>IDで検索して追加</h4>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <Input
                                    placeholder="ユーザーのID (例: friend123)"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                                <Button variant="secondary" onClick={handleSearch} disabled={isSearching}>検索</Button>
                            </div>

                            {searchResult && (
                                <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.1)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>{searchResult.display_name} (@{searchResult.username})</span>
                                        {groupMembers.some(member => member.id === searchResult.id) ? (
                                            <span style={{ fontSize: '0.8rem', color: '#666' }}>追加済み</span>
                                        ) : (
                                            <Button variant="primary" size="sm" onClick={() => handleInvite(searchResult.id)}>追加</Button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            <h4 style={{ fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>友達リストから追加</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto', marginBottom: '1.5rem', paddingRight: '0.5rem' }}>
                                {friends.length === 0 && <p style={{ fontSize: '0.875rem', color: '#666' }}>友達がいません。</p>}
                                {friends.map(friend => {
                                    const isMember = groupMembers.some(member => member.id === friend.id);
                                    return (
                                        <div key={friend.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.05)' }}>
                                            <span>{friend.display_name}</span>
                                            {isMember ? (
                                                <span style={{ fontSize: '0.8rem', color: '#666', padding: '0.25rem 0.5rem', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '12px' }}>追加済み</span>
                                            ) : (
                                                <Button variant="secondary" size="sm" onClick={() => handleInvite(friend.id)}>追加</Button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <Button variant="ghost" style={{ width: '100%' }} onClick={() => { setInviteGroupId(null); setSearchQuery(''); setSearchResult(null); }}>
                            閉じる
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};
