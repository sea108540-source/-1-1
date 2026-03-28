import React from 'react';
import { Calendar, Home as HomeIcon, Settings, User, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

type View = 'my-wishlist' | 'calendar' | 'friends' | 'groups' | 'settings';

interface BottomNavProps {
    currentView: View;
    onNavigate: (view: View) => void;
    onAuthRequest: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentView, onNavigate, onAuthRequest }) => {
    const { user } = useAuth();

    const handleNavigate = (view: View, requiresAuth: boolean) => {
        if (requiresAuth && !user) {
            onAuthRequest();
            return;
        }

        onNavigate(view);
    };

    return (
        <div
            style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                height: 'calc(64px + env(safe-area-inset-bottom))',
                background: 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderTop: '1px solid rgba(0, 0, 0, 0.05)',
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center',
                zIndex: 1000,
                boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.05)',
                paddingBottom: 'env(safe-area-inset-bottom)'
            }}
        >
            <NavItem icon={<HomeIcon size={24} />} label="ホーム" isActive={currentView === 'my-wishlist'} onClick={() => handleNavigate('my-wishlist', false)} />
            <NavItem icon={<Calendar size={24} />} label="カレンダー" isActive={currentView === 'calendar'} onClick={() => handleNavigate('calendar', true)} />
            <NavItem icon={<Users size={24} />} label="グループ" isActive={currentView === 'groups'} onClick={() => handleNavigate('groups', true)} />
            <NavItem icon={<User size={24} />} label="フレンド" isActive={currentView === 'friends'} onClick={() => handleNavigate('friends', true)} />
            <NavItem icon={<Settings size={24} />} label="設定" isActive={currentView === 'settings'} onClick={() => handleNavigate('settings', true)} />
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
            aria-label={label}
            aria-pressed={isActive}
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
                transition: 'color 0.2s ease'
            }}
        >
            <div
                style={{
                    transition: 'transform 0.2s ease',
                    transform: isActive ? 'translateY(-2px)' : 'translateY(0)'
                }}
            >
                {icon}
            </div>
            <span style={{ fontSize: '0.7rem', marginTop: '4px', fontWeight: isActive ? 600 : 400 }}>{label}</span>
        </button>
    );
};
