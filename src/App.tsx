import { useEffect, useState } from 'react';
import LoginForm from './components/LoginForm';
import AdminSetup from './components/AdminSetup';
import AdminPanel from './components/AdminPanel';
import ExpenseTracker from './components/ExpenseTracker';
import {
  SessionUser,
  clearLegacyAuthStorage,
  getSession,
  login,
  logout,
  setupAdmin,
} from './authApi';

interface NotificationState {
  message: string;
  type: 'success' | 'error';
}

function App() {
  const [ready, setReady] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [showAccess, setShowAccess] = useState(false);
  const [notification, setNotification] = useState<NotificationState>({ message: '', type: 'success' });

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification({ message: '', type: 'success' });
    }, 3000);
  };

  useEffect(() => {
    clearLegacyAuthStorage();
    getSession()
      .then((session) => {
        setNeedsSetup(session.needsSetup);
        setUser(session.user);
      })
      .catch(() => {
        showNotification('Could not reach the account server.', 'error');
      })
      .finally(() => setReady(true));
  }, []);

  const handleSetup = async (username: string, password: string) => {
    const result = await setupAdmin(username, password);
    setUser(result.user);
    setNeedsSetup(false);
    showNotification('Admin account created.');
  };

  const handleLogin = async (loginData: { username: string; password: string }) => {
    try {
      const result = await login(loginData.username, loginData.password);
      setUser(result.user);
      showNotification('Login successful!');
    } catch (caught) {
      showNotification(caught instanceof Error ? caught.message : 'Invalid username or password', 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      showNotification('Could not reach the account server.', 'error');
      return;
    }
    setUser(null);
    setShowAccess(false);
    showNotification('Logged out successfully');
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      {notification.message && (
        <div
          className={`fixed top-4 right-4 p-4 rounded-lg text-white ${
            notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {notification.message}
        </div>
      )}

      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <img
                src="/expensely.png"
                alt="Expensely Logo"
                className="h-8 w-auto"
              />
              <span className="ml-2 text-xl font-bold text-gray-800">
                Expensely
              </span>
            </div>
            {user && (
              <div className="flex items-center">
                <span className="mr-4 text-gray-600">
                  Welcome, {user.username}!
                </span>
                {user.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => setShowAccess((open) => !open)}
                    className="mr-2 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 btn"
                  >
                    {showAccess ? 'Hide access' : 'Access'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 btn"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!ready ? (
          <p className="text-center text-gray-600">Loading…</p>
        ) : needsSetup ? (
          <AdminSetup onSubmit={handleSetup} />
        ) : !user ? (
          <LoginForm onSubmit={handleLogin} />
        ) : (
          <>
            {user.role === 'admin' && showAccess && <AdminPanel currentUserId={user.id} />}
            <ExpenseTracker username={user.username} />
          </>
        )}
      </main>
    </div>
  );
}

export default App;
