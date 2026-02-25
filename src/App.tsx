import { AuthProvider } from './contexts/AuthContext';
import { Home } from './pages/Home';

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <Home />
      </div>
    </AuthProvider>
  );
}

export default App;
