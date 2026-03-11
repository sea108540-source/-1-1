import React from 'react';
import { Home as HomeIcon, Users, User, Settings } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface BottomNavProps {
    currentView: 'my-wishlist' | 'friends' | 'groups' | 'settings';
    onNavigate: (view: 'my-wishlist' | 'friends' | 'groups' | 'settings') => void;
    onAuthRequest: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentView, onNavigate, onAuthRequest }) => {
    const { user } = useAuth();

    const handleNavigate = (view: 'my-wishlist' | 'friends' | 'groups' | 'settings', requiresAuth: boolean) => {
        if (requiresAuth && !user) {
            onAuthRequest();
        } else {
            onNavigate(view);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: '64px',
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderTop: '1px solid rgba(0, 0, 0, 0.05)',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            zIndex: 1000,
            boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.05)',
            paddingBottom: 'env(safe-area-inset-bottom)' // iOS Safe Area対応
        }}>
            <NavItem 
                icon={<HomeIcon size={24} />} 
                label="ホーム" 
                isActive={currentView === 'my-wishlist'} 
                onClick={() => handleNavigate('my-wishlist', false)} 
            />
            <NavItem 
                icon={<Users size={24} />} 
                label="グループ" 
                isActive={currentView === 'groups'} 
                onClick={() => handleNavigate('groups', true)} 
            />
            <NavItem 
                icon={<User size={24} />} 
                label="友達" 
                isActive={currentView === 'friends'} 
                onClick={() => handleNavigate('friends', true)} 
            />
            <NavItem 
                icon={<Settings size={24} />} 
                label="設定" 
                isActive={currentView === 'settings'} 
                onClick={() => handleNavigate('settings', true)} 
            />
        </div>
    );
};

interface NavItemProps {
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, isActive, onClick }) => {
    return (
        <button
            onClick={onClick}
            style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                padding: '0.5rem',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'color 0.2s ease',
            }}
        >
            <div style={{
                transition: 'transform 0.2s ease',
                transform: isActive ? 'translateY(-2px)' : 'translateY(0)',
            }}>
                {icon}
            </div>
            <span style={{ 
                fontSize: '0.7rem', 
                marginTop: '4px',
                fontWeight: isActive ? 600 : 400
            }}>
                {label}
            </span>
        </button>
    );
};
