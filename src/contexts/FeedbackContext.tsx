import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import '../components/ui/ui.css';

type ToastType = 'success' | 'error' | 'info';
type ConfirmVariant = 'primary' | 'danger';

interface ToastOptions {
    message: string;
    type?: ToastType;
    duration?: number;
}

interface ConfirmOptions {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: ConfirmVariant;
}

interface ToastRecord extends Required<ToastOptions> {
    id: number;
}

interface ConfirmState {
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    variant: ConfirmVariant;
    resolve: (value: boolean) => void;
}

interface FeedbackContextType {
    showToast: (options: ToastOptions) => void;
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextType | null>(null);

const getToastIcon = (type: ToastType) => {
    switch (type) {
        case 'success':
            return <CheckCircle2 size={18} />;
        case 'error':
            return <AlertCircle size={18} />;
        default:
            return <Info size={18} />;
    }
};

export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastRecord[]>([]);
    const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
    const nextToastIdRef = useRef(1);
    const timeoutMapRef = useRef(new Map<number, number>());

    const removeToast = useCallback((id: number) => {
        const timeoutId = timeoutMapRef.current.get(id);
        if (timeoutId) {
            window.clearTimeout(timeoutId);
            timeoutMapRef.current.delete(id);
        }

        setToasts(previous => previous.filter(toast => toast.id !== id));
    }, []);

    const showToast = useCallback((options: ToastOptions) => {
        const id = nextToastIdRef.current++;
        const toast: ToastRecord = {
            id,
            message: options.message,
            type: options.type ?? 'info',
            duration: options.duration ?? 3000,
        };

        setToasts(previous => [...previous, toast]);

        const timeoutId = window.setTimeout(() => {
            removeToast(id);
        }, toast.duration);

        timeoutMapRef.current.set(id, timeoutId);
    }, [removeToast]);

    const confirm = useCallback((options: ConfirmOptions) => {
        return new Promise<boolean>(resolve => {
            setConfirmState({
                title: options.title ?? '確認',
                message: options.message,
                confirmLabel: options.confirmLabel ?? 'OK',
                cancelLabel: options.cancelLabel ?? 'キャンセル',
                variant: options.variant ?? 'primary',
                resolve,
            });
        });
    }, []);

    const closeConfirm = useCallback((confirmed: boolean) => {
        setConfirmState(previous => {
            if (!previous) {
                return previous;
            }

            previous.resolve(confirmed);
            return null;
        });
    }, []);

    const value = useMemo(() => ({ showToast, confirm }), [confirm, showToast]);

    return (
        <FeedbackContext.Provider value={value}>
            {children}

            <div className="toast-viewport" aria-live="polite" aria-atomic="true">
                {toasts.map(toast => (
                    <div key={toast.id} className={`toast toast-${toast.type}`} role="status">
                        <div className="toast-icon">{getToastIcon(toast.type)}</div>
                        <div className="toast-message">{toast.message}</div>
                        <button className="toast-close" onClick={() => removeToast(toast.id)} aria-label="通知を閉じる">
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>

            <Modal
                isOpen={Boolean(confirmState)}
                onClose={() => closeConfirm(false)}
                title={confirmState?.title ?? '確認'}
                footer={(
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
                        <Button variant="ghost" onClick={() => closeConfirm(false)}>
                            {confirmState?.cancelLabel ?? 'キャンセル'}
                        </Button>
                        <Button variant={confirmState?.variant ?? 'primary'} onClick={() => closeConfirm(true)}>
                            {confirmState?.confirmLabel ?? 'OK'}
                        </Button>
                    </div>
                )}
            >
                <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                    {confirmState?.message}
                </p>
            </Modal>
        </FeedbackContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useFeedback = () => {
    const context = useContext(FeedbackContext);
    if (!context) {
        throw new Error('useFeedback must be used within a FeedbackProvider');
    }

    return context;
};
