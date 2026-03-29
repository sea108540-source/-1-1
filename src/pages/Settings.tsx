import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ArrowLeft, Copy, Download, LogOut, Plus, User as UserIcon } from 'lucide-react';
import { exportDataAsJsonFile } from '../lib/shareUtils';
import { getItems, getMonthlyBudget, setMonthlyBudget } from '../lib/db';

interface SettingsProps {
    onBack: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onBack }) => {
    const { user } = useAuth();
    const { confirm, showToast } = useFeedback();
    const [displayName, setDisplayName] = useState('');
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [birthday, setBirthday] = useState('');
    const [targetMonth, setTargetMonth] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [monthlyBudget, setMonthlyBudgetVal] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [profileSaving, setProfileSaving] = useState(false);
    const [budgetSaving, setBudgetSaving] = useState(false);
    const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [budgetMessage, setBudgetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [publicMessage, setPublicMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const publicProfileUrl = username ? `${window.location.origin}/p/${username}` : '';

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) {
                setLoading(false);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (error) throw error;

                setDisplayName(data.display_name || '');
                setUsername(data.username || '');
                setBio(data.bio || '');
                setBirthday(data.birthday || '');
                setAvatarUrl(data.avatar_url || '');
            } catch (error) {
                console.error('Error fetching profile:', error);
                setProfileMessage({ type: 'error', text: 'プロフィールの読み込みに失敗しました。' });
            } finally {
                setLoading(false);
            }
        };

        void fetchProfile();
    }, [user]);

    useEffect(() => {
        const fetchBudget = async () => {
            if (!user || !targetMonth) return;

            try {
                const budget = await getMonthlyBudget(targetMonth);
                setMonthlyBudgetVal(budget > 0 ? budget.toString() : '');
            } catch (error) {
                console.error('Error fetching monthly budget:', error);
            }
        };

        void fetchBudget();
    }, [user, targetMonth]);

    useEffect(() => {
        return () => {
            if (avatarPreview) {
                URL.revokeObjectURL(avatarPreview);
            }
        };
    }, [avatarPreview]);

    const handleSaveProfile = async () => {
        if (!user) return;

        setProfileSaving(true);
        setProfileMessage(null);
        setPublicMessage(null);

        const validUsernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
        if (!validUsernameRegex.test(username)) {
            setProfileMessage({ type: 'error', text: 'ID は 3〜20 文字の英数字またはアンダースコアで入力してください。' });
            setProfileSaving(false);
            return;
        }

        try {
            let finalAvatarUrl = avatarUrl;

            if (avatarFile) {
                const fileExt = avatarFile.name.split('.').pop();
                const fileName = `${user.id}/${Date.now()}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(fileName, avatarFile, { upsert: true });

                if (uploadError) {
                    throw new Error(`画像のアップロードに失敗しました: ${uploadError.message}`);
                }

                const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
                finalAvatarUrl = data.publicUrl;
            }

            const updates = {
                id: user.id,
                display_name: displayName,
                username,
                bio,
                birthday: birthday || null,
                avatar_url: finalAvatarUrl,
                updated_at: new Date().toISOString(),
            };

            const { error } = await supabase.from('profiles').upsert(updates);

            if (error) {
                if (error.code === '23505') {
                    throw new Error('その ID はすでに使われています。別の ID を設定してください。');
                }
                throw error;
            }

            setProfileMessage({ type: 'success', text: 'プロフィールを更新しました。' });

            if (avatarFile) {
                setAvatarUrl(finalAvatarUrl);
                setAvatarFile(null);
                if (avatarPreview) {
                    URL.revokeObjectURL(avatarPreview);
                }
                setAvatarPreview(null);
            }
        } catch (error) {
            const text = error instanceof Error ? error.message : 'プロフィールの更新に失敗しました。';
            setProfileMessage({ type: 'error', text });
        } finally {
            setProfileSaving(false);
        }
    };

    const handleSaveBudget = async () => {
        if (!user || !targetMonth) return;

        setBudgetSaving(true);
        setBudgetMessage(null);

        const budgetNum = monthlyBudget.trim() ? Number.parseInt(monthlyBudget, 10) : 0;
        if (Number.isNaN(budgetNum) || budgetNum < 0) {
            setBudgetMessage({ type: 'error', text: '予算は 0 以上の整数で入力してください。' });
            setBudgetSaving(false);
            return;
        }

        try {
            await setMonthlyBudget(targetMonth, budgetNum);
            setBudgetMessage({ type: 'success', text: `${targetMonth} の予算を保存しました。` });
        } catch (error) {
            const text = error instanceof Error ? error.message : '予算の保存に失敗しました。';
            setBudgetMessage({ type: 'error', text });
        } finally {
            setBudgetSaving(false);
        }
    };

    const handleExportData = async () => {
        try {
            const items = await getItems();
            if (items.length === 0) {
                showToast({ type: 'info', message: 'エクスポートできるアイテムがありません。' });
                return;
            }
            exportDataAsJsonFile(items);
        } catch (error) {
            console.error('Export error:', error);
            showToast({ type: 'error', message: 'データのエクスポートに失敗しました。' });
        }
    };

    const handleCopyPublicProfileUrl = async () => {
        if (!publicProfileUrl) return;

        try {
            await navigator.clipboard.writeText(publicProfileUrl);
            setPublicMessage({ type: 'success', text: '公開プロフィール URL をコピーしました。' });
        } catch (error) {
            console.error('Copy error:', error);
            setPublicMessage({ type: 'error', text: '公開プロフィール URL のコピーに失敗しました。' });
        }
    };

    const handleLogout = async () => {
        const shouldLogout = await confirm({
            title: 'ログアウト',
            message: 'ログアウトしますか？',
            confirmLabel: 'ログアウト',
        });
        if (!shouldLogout) return;

        await supabase.auth.signOut();
        onBack();
    };

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>読み込み中...</div>;
    }

    if (!user) {
        return (
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    <button onClick={onBack} className="modal-close" style={{ background: 'var(--bg-glass)', padding: '0.5rem' }} aria-label="前の画面へ戻る">
                        <ArrowLeft size={24} />
                    </button>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>設定</h1>
                </div>
                <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    ログインすると設定を編集できます。
                </div>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <button onClick={onBack} className="modal-close" style={{ background: 'var(--bg-glass)', padding: '0.5rem' }} aria-label="前の画面へ戻る">
                    <ArrowLeft size={24} />
                </button>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>設定</h1>
            </div>

            <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>プロフィール設定</h2>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        style={{ position: 'relative', cursor: 'pointer', display: 'inline-block' }}
                        title="画像を変更"
                    >
                        {(avatarPreview || avatarUrl) ? (
                            <img src={avatarPreview || avatarUrl} alt="Avatar" style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)', transition: 'opacity 0.2s' }} />
                        ) : (
                            <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed var(--glass-border)' }}>
                                <UserIcon size={40} color="var(--text-muted)" />
                            </div>
                        )}
                        <div
                            style={{
                                position: 'absolute',
                                right: -4,
                                bottom: -4,
                                background: 'var(--primary)',
                                color: 'white',
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '2px solid var(--glass-panel)',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                            }}
                        >
                            <Plus size={16} />
                        </div>
                    </div>
                    <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={event => {
                            if (event.target.files && event.target.files[0]) {
                                const file = event.target.files[0];
                                if (avatarPreview) {
                                    URL.revokeObjectURL(avatarPreview);
                                }
                                setAvatarFile(file);
                                setAvatarPreview(URL.createObjectURL(file));
                            }
                        }}
                    />
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>アイコンをタップして画像を変更</p>
                </div>

                <Input
                    label="表示名"
                    placeholder="表示名"
                    value={displayName}
                    onChange={event => setDisplayName(event.target.value)}
                />

                <div className="input-wrapper">
                    <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>ID (Username)</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>公開 URL とユーザー検索に使われます</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ padding: '0 0.5rem', color: 'var(--text-secondary)' }}>@</span>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="username"
                            value={username}
                            onChange={event => setUsername(event.target.value)}
                            style={{ flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, paddingLeft: '0.5rem' }}
                        />
                    </div>
                </div>

                <div className="input-wrapper">
                    <label className="input-label">自己紹介</label>
                    <textarea
                        className="input-field"
                        placeholder="自己紹介を入力"
                        value={bio}
                        onChange={event => setBio(event.target.value)}
                        style={{ minHeight: '100px', resize: 'vertical', paddingTop: '0.75rem' }}
                    />
                </div>

                <div className="input-wrapper">
                    <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>誕生日</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>公開プロフィールにも表示されます</span>
                    </label>
                    <input
                        type="date"
                        className="input-field"
                        value={birthday}
                        onChange={event => setBirthday(event.target.value)}
                        style={{ colorScheme: 'dark' }}
                    />
                </div>

                {profileMessage && (
                    <div
                        style={{
                            padding: '1rem',
                            borderRadius: 'var(--radius-md)',
                            background: profileMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: profileMessage.type === 'success' ? '#10b981' : '#ef4444',
                            border: `1px solid ${profileMessage.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                        }}
                    >
                        {profileMessage.text}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <Button variant="primary" onClick={handleSaveProfile} disabled={profileSaving}>
                        {profileSaving ? '保存中...' : 'プロフィールを保存'}
                    </Button>
                </div>
            </div>

            <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>予算設定</h2>
                <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
                    <label className="input-label" style={{ fontWeight: 600 }}>月予算の設定</label>
                    <div className="input-wrapper">
                        <label className="input-label">対象の月</label>
                        <input
                            type="month"
                            className="input-field"
                            value={targetMonth}
                            onChange={event => setTargetMonth(event.target.value)}
                            style={{ colorScheme: 'dark' }}
                        />
                    </div>
                    <div className="input-wrapper">
                        <label className="input-label">その月の予算</label>
                        <Input
                            type="number"
                            placeholder="例: 50000"
                            value={monthlyBudget}
                            onChange={event => setMonthlyBudgetVal(event.target.value)}
                        />
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        ホームでは、必要日がこの月に設定された未購入アイテムと比較します。
                    </p>
                </div>

                {budgetMessage && (
                    <div
                        style={{
                            padding: '1rem',
                            borderRadius: 'var(--radius-md)',
                            background: budgetMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: budgetMessage.type === 'success' ? '#10b981' : '#ef4444',
                            border: `1px solid ${budgetMessage.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                        }}
                    >
                        {budgetMessage.text}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button variant="primary" onClick={handleSaveBudget} disabled={budgetSaving}>
                        {budgetSaving ? '保存中...' : '予算を保存'}
                    </Button>
                </div>
            </div>

            <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>公開設定</h2>
                <div style={{ padding: '1.5rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>公開プロフィール URL</h3>
                    <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        SNS やメッセージで共有すると、あなたの公開プロフィールと公開中のアイテムを見てもらえます。
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                            type="text"
                            readOnly
                            value={publicProfileUrl || 'ID (Username) を設定すると公開プロフィール URL が表示されます'}
                            className="input-field"
                            style={{
                                flex: 1,
                                color: 'var(--text-primary)',
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid var(--glass-border)',
                                fontSize: '0.9rem'
                            }}
                            onClick={event => {
                                if (publicProfileUrl) {
                                    event.currentTarget.select();
                                }
                            }}
                        />
                        <Button variant="primary" disabled={!publicProfileUrl} onClick={handleCopyPublicProfileUrl}>
                            <Copy size={16} /> コピー
                        </Button>
                    </div>
                    {!username && (
                        <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            公開 URL を使うには、先に `ID (Username)` を設定してください。
                        </p>
                    )}
                    {publicMessage && (
                        <div
                            style={{
                                marginTop: '1rem',
                                padding: '0.875rem 1rem',
                                borderRadius: 'var(--radius-md)',
                                background: publicMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                color: publicMessage.type === 'success' ? '#10b981' : '#ef4444',
                                border: `1px solid ${publicMessage.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                            }}
                        >
                            {publicMessage.text}
                        </div>
                    )}
                </div>
            </div>

            <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>アカウント管理</h2>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                        <h4 style={{ margin: '0 0 0.25rem 0' }}>データのエクスポート</h4>
                        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>登録した全アイテムをバックアップできます。</p>
                    </div>
                    <Button variant="secondary" icon={<Download size={16} />} onClick={handleExportData}>
                        エクスポート
                    </Button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                    <div>
                        <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--danger)' }}>ログアウト</h4>
                        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>現在のアカウントからサインアウトします。</p>
                    </div>
                    <Button variant="danger" icon={<LogOut size={16} />} onClick={handleLogout}>
                        ログアウト
                    </Button>
                </div>
            </div>
        </div>
    );
};
