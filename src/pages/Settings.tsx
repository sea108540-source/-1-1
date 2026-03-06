import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ArrowLeft, User as UserIcon, LogOut, Download, Plus } from 'lucide-react';
import { exportDataAsJsonFile } from '../lib/shareUtils';
import { getItems } from '../lib/db';

interface SettingsProps {
    onBack: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onBack }) => {
    const { user } = useAuth();
    const [displayName, setDisplayName] = useState('');
    const [username, setUsername] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) return;
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (error) throw error;
                setDisplayName(data.display_name || '');
                setUsername(data.username || '');
                setAvatarUrl(data.avatar_url || '');
            } catch (error) {
                console.error('Error fetching profile:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [user]);

    const handleSaveProfile = async () => {
        if (!user) return;
        setSaving(true);
        setMessage(null);

        // Basic validation for username
        const validUsernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
        if (!validUsernameRegex.test(username)) {
            setMessage({ type: 'error', text: 'IDは3〜20文字の半角英数字とアンダースコア（_）のみ使用できます。' });
            setSaving(false);
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
                    console.error('Upload error details:', uploadError);
                    throw new Error(`画像のアップロードに失敗しました。(${uploadError.message})`);
                }

                const { data } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(fileName);

                finalAvatarUrl = data.publicUrl;
            }

            const updates = {
                id: user.id,
                display_name: displayName,
                username,
                avatar_url: finalAvatarUrl,
                updated_at: new Date().toISOString(),
            };

            const { error } = await supabase.from('profiles').upsert(updates);

            if (error) {
                if (error.code === '23505') { // Unique violation
                    throw new Error('このIDは既に使用されています。別のIDをお試しください。');
                }
                throw error;
            }

            setMessage({ type: 'success', text: 'プロフィールを更新しました。' });
            if (avatarFile) {
                setAvatarUrl(finalAvatarUrl);
                setAvatarFile(null);
                setAvatarPreview(null);
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'プロフィールの更新に失敗しました。' });
        } finally {
            setSaving(false);
        }
    };

    const handleExportData = async () => {
        try {
            const items = await getItems();
            if (items.length === 0) {
                alert('エクスポートするアイテムがありません。');
                return;
            }
            exportDataAsJsonFile(items);
        } catch (error) {
            console.error('Export error:', error);
            alert('データのエクスポートに失敗しました。');
        }
    };

    const handleLogout = async () => {
        if (confirm('ログアウトしますか？')) {
            await supabase.auth.signOut();
            onBack(); // Return to home/auth screen
        }
    };

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>読み込み中...</div>;
    }

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            {/* Header */}
            <header style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <Button variant="ghost" onClick={onBack} size="sm">
                    <ArrowLeft size={20} />
                </Button>
                <h1 className="text-gradient" style={{ fontSize: '2rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                    設定
                </h1>
            </header>

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
                        <div style={{
                            position: 'absolute', right: -4, bottom: -4, background: 'var(--primary)', color: 'white',
                            width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: '2px solid var(--glass-panel)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}>
                            <Plus size={16} />
                        </div>
                    </div>
                    <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                                const file = e.target.files[0];
                                setAvatarFile(file);
                                setAvatarPreview(URL.createObjectURL(file));
                            }
                        }}
                    />
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>アイコンをタップして画像を選択</p>
                </div>

                <Input
                    label="表示名 (Display Name)"
                    placeholder="あなたの名前"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                />

                <div className="input-wrapper">
                    <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>ID (Username)</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>友達検索に使われます</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ padding: '0 0.5rem', color: 'var(--text-secondary)' }}>@</span>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="username"
                            value={username}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                            style={{ flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, paddingLeft: '0.5rem' }}
                        />
                    </div>
                </div>

                {message && (
                    <div style={{
                        padding: '1rem',
                        borderRadius: 'var(--radius-md)',
                        background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: message.type === 'success' ? '#10b981' : '#ef4444',
                        border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                    }}>
                        {message.text}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <Button variant="primary" onClick={handleSaveProfile} disabled={saving}>
                        {saving ? '保存中...' : 'プロフィールを保存'}
                    </Button>
                </div>
            </div>

            <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>アカウント操作</h2>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h4 style={{ margin: '0 0 0.25rem 0' }}>データのエクスポート</h4>
                        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>登録した全アイテムをバックアップします。</p>
                    </div>
                    <Button variant="secondary" icon={<Download size={16} />} onClick={handleExportData}>
                        保存
                    </Button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                    <div>
                        <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--danger)' }}>ログアウト</h4>
                        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>アカウントからサインアウトします。</p>
                    </div>
                    <Button variant="danger" icon={<LogOut size={16} />} onClick={handleLogout}>
                        ログアウト
                    </Button>
                </div>
            </div>
        </div>
    );
};
