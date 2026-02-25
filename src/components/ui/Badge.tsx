import React from 'react';
import './ui.css';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'info' | 'success' | 'warning' | 'danger' | 'default';
    className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', className = '' }) => {
    const badgeClass = variant === 'default' ? 'badge default-badge' : `badge badge-${variant}`;

    return (
        <span className={`${badgeClass} ${className}`}>
            {children}
        </span>
    );
};
