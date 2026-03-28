import React from 'react';
import { Plus } from 'lucide-react';

interface FloatingActionButtonProps {
    onClick: () => void;
    visible?: boolean;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ onClick, visible = true }) => {
    if (!visible) return null;

    return (
        <button
            onClick={onClick}
            style={{
                position: 'fixed',
                bottom: '80px',
                right: '1.5rem',
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-primary)',
                color: 'white',
                border: 'none',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 999,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}
            onMouseOver={e => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.2) inset';
            }}
            onMouseOut={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1) inset';
            }}
            aria-label="アイテムを追加"
        >
            <Plus size={28} />
        </button>
    );
};
