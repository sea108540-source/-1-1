import { AuthProvider } from './contexts/AuthContext';
import { Home } from './pages/Home';
import { PublicProfile } from './pages/PublicProfile';

function App() {
  const path = window.location.pathname;

  // 公開プロフィールのルーティング
  if (path.startsWith('/p/')) {
    const username = path.split('/')[2];
    if (username) {
      return (
        <div className="App">
          <PublicProfile username={username} />
        </div>
      );
    }
  }

  // デフォルトアプリ（要認証）
  return (
    <AuthProvider>
      <div className="App">
        <Home />
      </div>
    </AuthProvider>
  );
}

export default App;
