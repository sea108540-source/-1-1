import React, { Suspense, lazy } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { FeedbackProvider } from './contexts/FeedbackContext';
import { getPublicProfileUsername, isPublicProfilePath } from './lib/routes';
import { useEffect, useState } from 'react';

const Home = lazy(() => import('./pages/Home').then(module => ({ default: module.Home })));
const PublicProfile = lazy(() => import('./pages/PublicProfile').then(module => ({ default: module.PublicProfile })));

const AppFallback: React.FC = () => (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        読み込み中...
    </div>
);

function App() {
    const [pathname, setPathname] = useState(() => window.location.pathname);

    useEffect(() => {
        const handlePopState = () => {
            setPathname(window.location.pathname);
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const username = isPublicProfilePath(pathname) ? getPublicProfileUsername(pathname) : undefined;

    return (
        <AuthProvider>
            <FeedbackProvider>
                <div className="App">
                    <Suspense fallback={<AppFallback />}>
                        {username ? <PublicProfile username={username} /> : <Home routePath={pathname} />}
                    </Suspense>
                </div>
            </FeedbackProvider>
        </AuthProvider>
    );
}

export default App;
