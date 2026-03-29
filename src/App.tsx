import React, { Suspense, lazy } from 'react';
import { AuthProvider } from './contexts/AuthContext';

const Home = lazy(() => import('./pages/Home').then(module => ({ default: module.Home })));
const PublicProfile = lazy(() => import('./pages/PublicProfile').then(module => ({ default: module.PublicProfile })));

const AppFallback: React.FC = () => (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        読み込み中...
    </div>
);

function App() {
    const path = window.location.pathname;
    const isPublicProfileRoute = path.startsWith('/p/');
    const username = isPublicProfileRoute ? path.split('/')[2] : undefined;

    return (
        <AuthProvider>
            <div className="App">
                <Suspense fallback={<AppFallback />}>
                    {username ? <PublicProfile username={username} /> : <Home />}
                </Suspense>
            </div>
        </AuthProvider>
    );
}

export default App;
