import React, { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import ExpenseTracker from './components/ExpenseTracker';

interface NotificationState {
  message: string;
  type: 'success' | 'error';
}

interface LoginFormData {
  username: string;
  password: string;
}

interface RegisterFormData {
  username: string;
  password: string;
  confirmPassword: string;
}

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [showLogin, setShowLogin] = useState<boolean>(true);
  const [username, setUsername] = useState<string>('');
  const [notification, setNotification] = useState<NotificationState>({ message: '', type: 'success' });

  useEffect(() => {
    const storedLoginState = localStorage.getItem('isLoggedIn') === 'true';
    const storedUsername = localStorage.getItem('username');
    if (storedLoginState && storedUsername) {
      setIsLoggedIn(true);
      setUsername(storedUsername.trim().toLowerCase());
    }
  }, []);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification({ message: '', type: 'success' });
    }, 3000);
  };

  const handleLogin = (loginData: LoginFormData) => {
    const normalizedUsername = loginData.username.trim().toLowerCase();
    const storedPassword = localStorage.getItem(`password_${normalizedUsername}`);
    if (storedPassword === loginData.password) {
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('username', normalizedUsername);
      setIsLoggedIn(true);
      setUsername(normalizedUsername);
      showNotification('Login successful!');
    } else {
      showNotification('Invalid username or password', 'error');
    }
  };

  const handleRegister = (registerData: RegisterFormData) => {
    const normalizedUsername = registerData.username.trim().toLowerCase();
    if (registerData.password !== registerData.confirmPassword) {
      showNotification('Passwords do not match', 'error');
      return;
    }
    if (localStorage.getItem(`password_${normalizedUsername}`)) {
      showNotification('Username already exists', 'error');
      return;
    }
    localStorage.setItem(`password_${normalizedUsername}`, registerData.password);
    showNotification('Registration successful! Please login.');
    setShowLogin(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username');
    setIsLoggedIn(false);
    setUsername('');
    showNotification('Logged out successfully');
  };

  const toggleForm = () => {
    setShowLogin(!showLogin);
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      {/* Notification */}
      {notification.message && (
        <div
          className={`fixed top-4 right-4 p-4 rounded-lg text-white ${
            notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Navigation */}
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
            {isLoggedIn && (
              <div className="flex items-center">
                <span className="mr-4 text-gray-600">
                  Welcome, {username}!
                </span>
                <button
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isLoggedIn ? (
          showLogin ? (
            <LoginForm onToggleForm={toggleForm} onSubmit={handleLogin} />
          ) : (
            <RegisterForm onToggleForm={toggleForm} onSubmit={handleRegister} />
          )
        ) : (
          <ExpenseTracker username={username} />
        )}
      </main>
    </div>
  );
};

export default App;