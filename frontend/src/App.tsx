import { useState, useEffect } from 'react';
import { api } from './api';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [dbConnected, setDbConnected] = useState(false);

  // Action states
  const [dmUsername, setDmUsername] = useState('');
  const [dmMessage, setDmMessage] = useState('');
  const [targetAccount, setTargetAccount] = useState('');
  const [maxFollowers, setMaxFollowers] = useState(100);
  const [followers, setFollowers] = useState<string[]>([]);

  useEffect(() => {
    checkAuth();
    checkStatus();
  }, []);

  const checkAuth = async () => {
    try {
      const user = await api.getMe();
      setUsername(user.username);
      setIsAuthenticated(true);
    } catch {
      setIsAuthenticated(false);
    }
  };

  const checkStatus = async () => {
    try {
      const status = await api.getStatus();
      setDbConnected(status.dbConnected);
    } catch {
      setDbConnected(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      await api.login({ username, password });
      setIsAuthenticated(true);
      setMessage('✓ Login successful');
      setPassword('');
    } catch (error) {
      setMessage('✗ Login failed: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await api.logout();
      setIsAuthenticated(false);
      setUsername('');
      setMessage('Logged out');
    } catch (error) {
      setMessage('Logout failed: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleInteract = async () => {
    setLoading(true);
    setMessage('');
    try {
      const result = await api.interact();
      setMessage('✓ ' + result.message);
    } catch (error) {
      setMessage('✗ ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendDM = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const result = await api.sendDM({ username: dmUsername, message: dmMessage });
      setMessage('✓ ' + result.message);
      setDmUsername('');
      setDmMessage('');
    } catch (error) {
      setMessage('✗ ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleScrapeFollowers = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setFollowers([]);
    try {
      const result = await api.scrapeFollowers({ targetAccount, maxFollowers });
      if (result.success && result.followers) {
        setFollowers(result.followers);
        setMessage(`✓ Found ${result.followers.length} followers`);
      } else {
        setMessage('✓ ' + JSON.stringify(result));
      }
    } catch (error) {
      setMessage('✗ ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearCookies = async () => {
    setLoading(true);
    setMessage('');
    try {
      const result = await api.clearCookies();
      setMessage('✓ ' + result.message);
    } catch (error) {
      setMessage('✗ ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="app">
        <div className="container">
          <h1>🌸 Riona AI Agent</h1>
          <div className="status">
            Database: {dbConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
          
          <form onSubmit={handleLogin} className="form">
            <h2>Login to Instagram</h2>
            <input
              type="text"
              placeholder="Instagram Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
            />
            <input
              type="password"
              placeholder="Instagram Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          
          {message && <div className="message">{message}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="container">
        <div className="header">
          <h1>🌸 Riona AI Agent</h1>
          <div className="user-info">
            <span>@{username}</span>
            <button onClick={handleLogout} disabled={loading}>Logout</button>
          </div>
        </div>

        <div className="status">
          Database: {dbConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>

        {message && <div className="message">{message}</div>}

        <div className="actions">
          <div className="action-card">
            <h3>Interact with Posts</h3>
            <p>Like and comment on posts in your feed</p>
            <button onClick={handleInteract} disabled={loading}>
              Start Interaction
            </button>
          </div>

          <div className="action-card">
            <h3>Send Direct Message</h3>
            <form onSubmit={handleSendDM}>
              <input
                type="text"
                placeholder="Username"
                value={dmUsername}
                onChange={(e) => setDmUsername(e.target.value)}
                required
                disabled={loading}
              />
              <textarea
                placeholder="Message"
                value={dmMessage}
                onChange={(e) => setDmMessage(e.target.value)}
                required
                disabled={loading}
                rows={3}
              />
              <button type="submit" disabled={loading}>Send DM</button>
            </form>
          </div>

          <div className="action-card">
            <h3>Scrape Followers</h3>
            <form onSubmit={handleScrapeFollowers}>
              <input
                type="text"
                placeholder="Target Account"
                value={targetAccount}
                onChange={(e) => setTargetAccount(e.target.value)}
                required
                disabled={loading}
              />
              <input
                type="number"
                placeholder="Max Followers"
                value={maxFollowers}
                onChange={(e) => setMaxFollowers(Number(e.target.value))}
                required
                disabled={loading}
                min="1"
              />
              <button type="submit" disabled={loading}>Scrape</button>
            </form>
            {followers.length > 0 && (
              <div className="followers-list">
                <h4>Followers ({followers.length}):</h4>
                <div className="followers-scroll">
                  {followers.map((follower, i) => (
                    <div key={i} className="follower">{follower}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="action-card">
            <h3>Clear Cookies</h3>
            <p>Clear Instagram session cookies</p>
            <button onClick={handleClearCookies} disabled={loading}>
              Clear Cookies
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
