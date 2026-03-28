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

    const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!email || !password) return;

        setLoading(true);
        setMessage(null);

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;

                setMessage({
                    text: 'アカウントを作成しました。確認メールを送信している場合は、メール内の案内に従ってください。',
                    type: 'success'
                });
                setTimeout(() => onClose(), 1500);
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                onClose();
            }
        } catch (err) {
            let errorMessage = err instanceof Error ? err.message : '認証に失敗しました。';

            if (errorMessage.toLowerCase().includes('rate limit')) {
                errorMessage = '試行回数が多すぎます。少し時間をおいてから再度お試しください。';
            } else if (errorMessage.includes('Invalid login credentials')) {
                errorMessage = 'メールアドレスまたはパスワードが正しくありません。';
            } else if (errorMessage.includes('User already registered')) {
                errorMessage = 'このメールアドレスは既に登録されています。';
            } else if (errorMessage.includes('Password should be at least')) {
                errorMessage = 'パスワードは6文字以上で入力してください。';
            } else if (errorMessage.includes('Email address is invalid')) {
                errorMessage = 'メールアドレスの形式が正しくありません。';
            }

            setMessage({ text: errorMessage, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const footer = (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
            <Button variant="ghost" onClick={onClose} disabled={loading}>
                キャンセル
            </Button>
            <Button variant="primary" onClick={() => undefined} type="submit" form="auth-form" disabled={loading}>
                {loading ? '処理中...' : isSignUp ? '新規登録' : 'ログイン'}
            </Button>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isSignUp ? 'アカウント作成' : 'ログイン'}
            footer={footer}
        >
            <form
                id="auth-form"
                onSubmit={handleAuth}
                style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
                {message && (
                    <div
                        style={{
                            padding: '0.75rem',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem',
                            background: message.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                            color: message.type === 'error' ? 'var(--danger)' : 'var(--success)',
                            border: `1px solid ${message.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                        }}
                    >
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
                        onClick={() => {
                            setIsSignUp(prev => !prev);
                            setMessage(null);
                        }}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent-primary)',
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            textDecoration: 'underline'
                        }}
                    >
                        {isSignUp ? '既にアカウントをお持ちの方はこちら' : 'アカウントをお持ちでない方はこちら'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};
