import { AuthProvider } from './contexts/AuthContext';
import { Home } from './pages/Home';
import { PublicProfile } from './pages/PublicProfile';

function App() {
  const path = window.location.pathname;
  const isPublicProfileRoute = path.startsWith('/p/');
  const username = isPublicProfileRoute ? path.split('/')[2] : undefined;

  return (
    <AuthProvider>
      <div className="App">
        {username ? <PublicProfile username={username} /> : <Home />}
      </div>
    </AuthProvider>
  );
}

export default App;
