import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;

        setLoading(true);
        setMessage(null);
        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                // Supabaseの設定によってはEmail確認不要で即時ログインされます
                setMessage({ text: 'アカウント登録・ログイン処理が完了しました（もしくは確認メールをご確認ください）', type: 'success' });
                setTimeout(() => onClose(), 1500);
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                onClose();
            }
        } catch (err: any) {
            let errorMsg = err.message;
            // 日本語への翻訳処理
            if (errorMsg.toLowerCase().includes('rate limit')) {
                errorMsg = 'メール送信の制限回数を超過しました。約1時間ほど時間をおいてから再度お試しください。';
            } else if (errorMsg.includes('Invalid login credentials')) {
                errorMsg = 'メールアドレスまたはパスワードが間違っています。';
            } else if (errorMsg.includes('User already registered')) {
                errorMsg = 'このメールアドレスは既に登録されています。';
            } else if (errorMsg.includes('Password should be at least')) {
                errorMsg = 'パスワードは6文字以上で入力してください。';
            } else if (errorMsg.includes('Email address is invalid')) {
                errorMsg = '無効なメールアドレスの形式です。';
            }
            setMessage({ text: errorMsg, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const footer = (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
            <Button variant="ghost" onClick={onClose} disabled={loading}>キャンセル</Button>
            <Button variant="primary" onClick={handleAuth} disabled={loading}>
                {loading ? '処理中...' : isSignUp ? '登録してはじめる' : 'ログイン'}
            </Button>
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isSignUp ? 'アカウント登録' : 'ログイン'} footer={footer}>
            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {message && (
                    <div style={{
                        padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.875rem',
                        background: message.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        color: message.type === 'error' ? 'var(--danger)' : 'var(--success)',
                        border: `1px solid ${message.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                    }}>
                        {message.text}
                    </div>
                )}

                <Input
                    type="email"
                    label="メールアドレス"
                    placeholder="your@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    disabled={loading}
                />
                <Input
                    type="password"
                    label="パスワード"
                    placeholder="6文字以上"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    disabled={loading}
                />

                <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                    <button
                        type="button"
                        onClick={() => { setIsSignUp(!isSignUp); setMessage(null); }}
                        style={{
                            background: 'none', border: 'none', color: 'var(--accent-primary)',
                            fontSize: '0.875rem', cursor: 'pointer', textDecoration: 'underline'
                        }}
                    >
                        {isSignUp ? '既にアカウントをお持ちの方はこちら (ログイン)' : 'アカウントをお持ちでない方はこちら (登録)'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};
