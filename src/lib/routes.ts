export type AppView = 'my-wishlist' | 'calendar' | 'friends' | 'groups' | 'settings';

const normalizePath = (path: string) => {
    if (!path || path === '/') {
        return '/';
    }

    const trimmed = path.endsWith('/') ? path.slice(0, -1) : path;
    return trimmed || '/';
};

export const getViewFromPath = (path: string): AppView => {
    switch (normalizePath(path)) {
        case '/calendar':
            return 'calendar';
        case '/friends':
            return 'friends';
        case '/groups':
            return 'groups';
        case '/settings':
            return 'settings';
        default:
            return 'my-wishlist';
    }
};

export const getPathForView = (view: AppView) => {
    switch (view) {
        case 'calendar':
            return '/calendar';
        case 'friends':
            return '/friends';
        case 'groups':
            return '/groups';
        case 'settings':
            return '/settings';
        default:
            return '/';
    }
};

export const isPublicProfilePath = (path: string) => normalizePath(path).startsWith('/p/');

export const getPublicProfileUsername = (path: string) => {
    if (!isPublicProfilePath(path)) {
        return undefined;
    }

    const segments = normalizePath(path).split('/');
    return segments[2] ? decodeURIComponent(segments[2]) : undefined;
};
