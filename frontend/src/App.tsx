import { useState, useEffect } from 'react';
import { api } from './api';
import type { Comment, CommentStats, FollowUnfollowStats, FollowedUser } from './api';
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
  const [isInteracting, setIsInteracting] = useState(false);
  
  // Comment history states
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentStats, setCommentStats] = useState<CommentStats>({ total: 0, deleted: 0, today: 0 });
  const [showCommentHistory, setShowCommentHistory] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  
  // Navigation state
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'followers' | 'targets' | 'growth'>('dashboard');
  
  // Target Accounts states
  const [following, setFollowing] = useState<string[]>([]);
  const [targetAccounts, setTargetAccounts] = useState<string[]>([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  
  // Follow/Unfollow states
  const [followStats, setFollowStats] = useState<FollowUnfollowStats>({ 
    totalFollowed: 0, totalUnfollowed: 0, followedBack: 0, 
    pendingUnfollow: 0, todayFollowed: 0, todayUnfollowed: 0, conversionRate: 0 
  });
  const [followedUsers, setFollowedUsers] = useState<FollowedUser[]>([]);
  const [isFollowCampaignRunning, setIsFollowCampaignRunning] = useState(false);
  const [maxFollowsPerSession, setMaxFollowsPerSession] = useState(20);
  const [maxFollowsPerDay, setMaxFollowsPerDay] = useState(50);
  const [unfollowAfterDays, setUnfollowAfterDays] = useState(3);
  const [onlyUnfollowNonFollowers, setOnlyUnfollowNonFollowers] = useState(true);
  
  // Activity feed states
  const [activityLog, setActivityLog] = useState<Array<{
    id: string;
    timestamp: Date;
    type: 'like' | 'comment' | 'wait' | 'info' | 'error';
    message: string;
    details?: string;
  }>>([]);

  useEffect(() => {
    checkAuth();
    checkStatus();
    startActivityPolling();
  }, []);

  // Fetch comment stats and target accounts when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchCommentStats();
      fetchTargetAccounts();
      fetchFollowStats();
    }
  }, [isAuthenticated]);

  // Fetch target accounts when navigating to targets page
  useEffect(() => {
    if (isAuthenticated && currentPage === 'targets') {
      fetchTargetAccounts();
    }
  }, [currentPage, isAuthenticated]);
  
  const fetchFollowStats = async () => {
    try {
      const result = await api.getFollowStats();
      setFollowStats(result.stats);
    } catch (error) {
      console.error('Failed to fetch follow stats:', error);
    }
  };

  const fetchFollowedUsers = async (filter: string = 'all') => {
    try {
      const result = await api.getFollowedUsers(filter, 50);
      setFollowedUsers(result.users);
    } catch (error) {
      console.error('Failed to fetch followed users:', error);
    }
  };

  const handleStartFollowCampaign = async () => {
    if (targetAccounts.length === 0) {
      setMessage('✗ Please select target accounts first in the Target Accounts page');
      return;
    }

    setLoading(true);
    setMessage('');
    setIsFollowCampaignRunning(true);
    
    try {
      const result = await api.startFollowCampaign({
        targetAccounts,
        maxFollowsPerDay,
        maxFollowsPerSession,
        unfollowAfterDays,
        onlyUnfollowNonFollowers: true,
        delayBetweenFollows: { min: 30, max: 60 },
        skipIfAlreadyFollowing: true,
      });
      setMessage('✓ ' + result.message);
      addActivity('info', 'Follow campaign started', `Following users from ${targetAccounts.length} target accounts`);
    } catch (error) {
      setMessage('✗ ' + (error as Error).message);
      addActivity('error', 'Failed to start follow campaign', (error as Error).message);
      setIsFollowCampaignRunning(false);
    } finally {
      setLoading(false);
    }
  };

  const handleStopFollowCampaign = async () => {
    setLoading(true);
    setMessage('');
    
    try {
      const result = await api.stopFollowCampaign();
      setMessage('✓ ' + result.message);
      setIsFollowCampaignRunning(false);
      await fetchFollowStats();
      addActivity('info', 'Follow campaign stopped', result.message);
    } catch (error) {
      setMessage('✗ ' + (error as Error).message);
      addActivity('error', 'Failed to stop follow campaign', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartUnfollowCampaign = async () => {
    setLoading(true);
    setMessage('');
    
    try {
      const result = await api.startUnfollowCampaign({
        maxUnfollowsPerSession: 30,
        unfollowAfterDays,
        onlyUnfollowNonFollowers,
        delayBetweenUnfollows: { min: 20, max: 40 },
      });
      setMessage('✓ ' + result.message);
      addActivity('info', 'Unfollow campaign started', result.message);
      
      // Refresh stats after a delay
      setTimeout(() => fetchFollowStats(), 3000);
    } catch (error) {
      setMessage('✗ ' + (error as Error).message);
      addActivity('error', 'Failed to start unfollow campaign', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckFollowBacks = async () => {
    setLoading(true);
    setMessage('');
    
    try {
      const result = await api.checkFollowBacks(20);
      setMessage('✓ ' + result.message);
      addActivity('info', 'Checking follow-backs', result.message);
      
      // Refresh stats after a delay
      setTimeout(() => fetchFollowStats(), 5000);
    } catch (error) {
      setMessage('✗ ' + (error as Error).message);
      addActivity('error', 'Failed to check follow-backs', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Activity logging functions
  const addActivity = (type: 'like' | 'comment' | 'wait' | 'info' | 'error', message: string, details?: string) => {
    const newActivity = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      type,
      message,
      details
    };
    setActivityLog(prev => [newActivity, ...prev].slice(0, 50)); // Keep last 50 activities
  };

  const startActivityPolling = () => {
    // Poll for activity updates every 2 seconds
    const interval = setInterval(async () => {
      if (isInteracting) {
        try {
          // This would normally fetch from your backend
          // For now, we'll simulate some activities
          if (Math.random() > 0.6) {
            const activities = [
              { type: 'like' as const, message: 'Liked post 12', details: 'Post about startup advice' },
              { type: 'comment' as const, message: 'Commented on post 13', details: 'This resonates with our approach. We\'ve seen similar patterns in our industry.' },
              { type: 'wait' as const, message: 'Waiting 8.5 seconds', details: 'Before moving to the next post...' },
              { type: 'info' as const, message: 'Processing feed', details: 'Scanning for relevant posts' },
              { type: 'like' as const, message: 'Liked post 14', details: 'Tech innovation post' },
              { type: 'comment' as const, message: 'Commented on post 15', details: 'Interesting perspective. We\'re exploring similar solutions at our company.' },
              { type: 'wait' as const, message: 'Waiting 6.2 seconds', details: 'Rate limiting delay' },
              { type: 'info' as const, message: 'Expanding caption', details: 'Reading full post content' },
              { type: 'comment' as const, message: 'Commented on post 16', details: 'We\'ve implemented something similar. The results have been remarkable.' },
              { type: 'comment' as const, message: 'Commented on post 17', details: 'This aligns perfectly with our company\'s vision. For more insights like this, follow our journey!' },
              { type: 'comment' as const, message: 'Commented on post 18', details: 'Our team has been discussing this exact topic. We share similar insights regularly on our page.' },
              { type: 'comment' as const, message: 'Commented on post 19', details: 'We\'re seeing this trend in our industry too. Feel free to connect with us for more perspectives.' },
              { type: 'comment' as const, message: 'Commented on post 20', details: 'Our experience validates this approach. We\'d love to continue this conversation with you.' },
              { type: 'comment' as const, message: 'Commented on post 21', details: 'Valuable insights! Our team shares industry updates regularly - worth following.' }
            ];
            const randomActivity = activities[Math.floor(Math.random() * activities.length)];
            addActivity(randomActivity.type, randomActivity.message, randomActivity.details);
          }
        } catch (error) {
          console.error('Error fetching activity:', error);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  };

  // Start polling when component mounts
  useEffect(() => {
    const cleanup = startActivityPolling();
    return cleanup;
  }, [isInteracting]);

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

  const fetchComments = async () => {
    try {
      const result = await api.getComments({ limit: 50 });
      setComments(result.comments);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  };

  const fetchCommentStats = async () => {
    try {
      const result = await api.getCommentStats();
      setCommentStats(result.stats);
    } catch (error) {
      console.error('Failed to fetch comment stats:', error);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment from Instagram?')) {
      return;
    }
    
    setDeletingCommentId(commentId);
    setMessage('');
    try {
      await api.deleteComment(commentId);
      setMessage('✓ Comment deleted successfully');
      // Refresh comments and stats
      await fetchComments();
      await fetchCommentStats();
    } catch (error) {
      setMessage('✗ Failed to delete comment: ' + (error as Error).message);
    } finally {
      setDeletingCommentId(null);
    }
  };

  const handleViewCommentHistory = async () => {
    setShowCommentHistory(true);
    await fetchComments();
    await fetchCommentStats();
  };

  const fetchFollowing = async () => {
    setLoadingFollowing(true);
    try {
      const result = await api.getFollowing(1000); // Increased to load all following
      setFollowing(result.following);
      setMessage(`✓ Loaded ${result.following.length} accounts you're following`);
    } catch (error) {
      setMessage('✗ Failed to load following list: ' + (error as Error).message);
    } finally {
      setLoadingFollowing(false);
    }
  };

  const fetchTargetAccounts = async () => {
    try {
      const result = await api.getTargetAccounts();
      setTargetAccounts(result.targetAccounts);
      console.log(`Loaded ${result.targetAccounts.length} saved target accounts:`, result.targetAccounts);
    } catch (error) {
      console.error('Failed to fetch target accounts:', error);
    }
  };

  const handleToggleTargetAccount = (account: string) => {
    setTargetAccounts(prev => 
      prev.includes(account)
        ? prev.filter(a => a !== account)
        : [...prev, account]
    );
  };

  const handleSelectAllTargets = () => {
    setTargetAccounts([...following]);
  };

  const handleDeselectAllTargets = () => {
    setTargetAccounts([]);
  };

  const handleSaveTargetAccounts = async () => {
    setLoading(true);
    setMessage('');
    try {
      await api.updateTargetAccounts(targetAccounts);
      setMessage(`✓ Saved ${targetAccounts.length} target accounts`);
    } catch (error) {
      setMessage('✗ Failed to save target accounts: ' + (error as Error).message);
    } finally {
      setLoading(false);
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
    setIsInteracting(true);
    addActivity('info', 'Starting Instagram automation', 'Initializing interaction sequence');
    try {
      const result = await api.interact();
      setMessage('✓ ' + result.message);
      addActivity('info', 'Automation started successfully', result.message);
      // Don't set isInteracting to false here - let it run
    } catch (error) {
      setMessage('✗ ' + (error as Error).message);
      addActivity('error', 'Failed to start automation', (error as Error).message);
      setIsInteracting(false);
    } finally {
      setLoading(false);
    }
  };

  const handleStopInteractions = async () => {
    setLoading(true);
    setMessage('');
    addActivity('info', 'Stopping automation', 'User requested stop');
    try {
      const result = await api.stopInteractions();
      setMessage('✓ ' + result.message);
      addActivity('info', 'Automation stopped', result.message);
      setIsInteracting(false);
    } catch (error) {
      setMessage('✗ ' + (error as Error).message);
      addActivity('error', 'Failed to stop automation', (error as Error).message);
      setIsInteracting(false);
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
      <div className="login-page">
        <div className="login-container">
          {/* Left Panel - Welcome Section */}
          <div className="welcome-panel">
            <div className="welcome-content">
              <div className="logo-icon">✨</div>
              <h1 className="welcome-title">
                Hello<br />
                <span className="brand-name">SocialFlow AI</span> 👋
              </h1>
              <p className="welcome-description">
                Automate your social media marketing with AI-powered Instagram interactions. 
                Boost engagement, grow followers, and save hours of manual work!
              </p>
              <div className="copyright">
                © 2024 SocialFlow AI. All rights reserved.
              </div>
            </div>
          </div>

          {/* Right Panel - Login Form */}
          <div className="login-panel">
            <div className="login-content">
              <h2 className="login-brand">SocialFlow AI</h2>
              <h3 className="login-title">Welcome Back!</h3>
              <p className="signup-prompt">
                Don't have an account? <a href="#" className="signup-link">Create a new account now</a>. It's FREE! Takes less than a minute.
              </p>
              
              <form onSubmit={handleLogin} className="login-form">
                <div className="input-group">
                  <input
                    type="text"
                    placeholder="Instagram Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={loading}
                    className="login-input"
                  />
                </div>
                <div className="input-group">
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="login-input"
                  />
                </div>
                <button type="submit" disabled={loading} className="login-button">
                  {loading ? 'Logging in...' : 'Login Now'}
                </button>
              </form>

              <div className="google-login">
                <button type="button" className="google-button" disabled={loading}>
                  <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Login with Google
                </button>
              </div>

              <div className="forgot-password">
                <a href="#" className="forgot-link">Forget password? Click here</a>
              </div>

              {message && <div className="login-message">{message}</div>}
              
              <div className="status-indicator">
                Database: {dbConnected ? '🟢 Connected' : '🔴 Disconnected'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Sidebar Navigation */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h2 className="brand-title">SOCIALFLOW AI</h2>
        </div>
        
        <nav className="sidebar-nav">
          <div 
            className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentPage('dashboard')}
            style={{ cursor: 'pointer' }}
          >
            <div className="nav-icon">🏠</div>
            <span>Dashboard</span>
            {currentPage === 'dashboard' && <div className="nav-indicator"></div>}
          </div>
          <div 
            className={`nav-item ${currentPage === 'followers' ? 'active' : ''}`}
            onClick={() => setCurrentPage('followers')}
            style={{ cursor: 'pointer' }}
          >
            <div className="nav-icon">👥</div>
            <span>Followers & DM</span>
            {currentPage === 'followers' && <div className="nav-indicator"></div>}
          </div>
          <div 
            className={`nav-item ${currentPage === 'targets' ? 'active' : ''}`}
            onClick={() => setCurrentPage('targets')}
            style={{ cursor: 'pointer' }}
          >
            <div className="nav-icon">🎯</div>
            <span>Target Accounts</span>
            {currentPage === 'targets' && <div className="nav-indicator"></div>}
          </div>
          <div 
            className={`nav-item ${currentPage === 'growth' ? 'active' : ''}`}
            onClick={() => setCurrentPage('growth')}
            style={{ cursor: 'pointer' }}
          >
            <div className="nav-icon">📈</div>
            <span>Follow/Unfollow</span>
            {currentPage === 'growth' && <div className="nav-indicator"></div>}
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="balance-card">
            <div className="balance-header">
              <span>Instagram Status</span>
            </div>
            <div className="balance-amount">
              {dbConnected ? '🟢 Connected' : '🔴 Disconnected'}
            </div>
            <div className="balance-chart">
              <div className="mini-chart">
                <div className="chart-bar"></div>
                <div className="chart-bar"></div>
                <div className="chart-bar"></div>
                <div className="chart-bar active"></div>
              </div>
            </div>
          </div>
          
          <div className="user-profile">
            <div className="profile-avatar">
              <div className="avatar-circle">@{username.charAt(0).toUpperCase()}</div>
              <div className="camera-icon">📷</div>
            </div>
            <div className="profile-name">@{username}</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Header */}
        <div className="dashboard-header">
          <div className="header-left">
            <div className="breadcrumb">
              {currentPage === 'dashboard' && 'Dashboard / Instagram Automation'}
              {currentPage === 'followers' && 'Dashboard / Followers & DM'}
              {currentPage === 'targets' && 'Dashboard / Target Accounts'}
              {currentPage === 'growth' && 'Dashboard / Follow/Unfollow Growth'}
            </div>
            <h1 className="page-title">
              {currentPage === 'dashboard' && 'Instagram Automation'}
              {currentPage === 'followers' && 'Followers & Direct Messages'}
              {currentPage === 'targets' && 'Target Accounts for Auto-Comment'}
              {currentPage === 'growth' && 'Follow/Unfollow Growth Strategy'}
            </h1>
          </div>
          <div className="header-right">
            <div className="search-bar">
              <input type="text" placeholder="Search..." />
              <div className="search-icon">🔍</div>
            </div>
            <div className="header-actions">
              <button className="notification-btn">🔔</button>
              <button className="message-btn">💬</button>
              {isInteracting ? (
                <button onClick={handleStopInteractions} className="logout-btn stop-btn">
                  Stop Bot
                </button>
              ) : (
                <button onClick={handleLogout} className="logout-btn" disabled={loading}>
                  Logout
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Status Message */}
        {message && <div className="status-message">{message}</div>}

        {/* Dashboard Page */}
        {currentPage === 'dashboard' && (
        <div className="dashboard-grid">
          {/* Row 1 */}
          <div className="dashboard-card stats-card">
            <div className="card-header">
              <h3>Interaction Status</h3>
              <div className="status-indicator">
                {isInteracting ? '🟢 Active' : '⚪ Idle'}
              </div>
            </div>
            <div className="stats-content">
              <div className="stat-value">
                {isInteracting ? 'Running' : 'Stopped'}
              </div>
              <div className="stat-change">
                {isInteracting ? '+1.2%' : '0%'}
              </div>
            </div>
            <div className="mini-chart">
              <div className="chart-line"></div>
            </div>
          </div>

          {/* Row 2 */}
          <div className="dashboard-card interaction-card">
            <div className="card-header">
              <h3>Post Interaction</h3>
            </div>
            <div className="card-content">
              <p className="card-description">Like and comment on posts in your feed</p>
              {isInteracting ? (
                <button onClick={handleStopInteractions} className="action-button stop-button">
                  Stop Interaction
                </button>
              ) : (
                <button onClick={handleInteract} disabled={loading} className="action-button">
                  Start Interaction
                </button>
              )}
            </div>
          </div>

          <div className="dashboard-card cookies-card">
            <div className="card-header">
              <h3>Session Management</h3>
            </div>
            <div className="card-content">
              <p className="card-description">Clear Instagram session cookies</p>
              <button onClick={handleClearCookies} disabled={loading} className="action-button">
                Clear Cookies
              </button>
            </div>
          </div>

          {/* Comment Stats Card */}
          <div className="dashboard-card comment-stats-card">
            <div className="card-header">
              <h3>Comment Statistics</h3>
            </div>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-label">Total Comments</div>
                <div className="stat-value">{commentStats.total}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Today</div>
                <div className="stat-value">{commentStats.today}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Deleted</div>
                <div className="stat-value">{commentStats.deleted}</div>
              </div>
            </div>
            <button onClick={handleViewCommentHistory} disabled={loading} className="action-button">
              View Comment History
            </button>
          </div>

          {/* Activity Feed */}
          <div className="dashboard-card activity-feed-card">
            <div className="card-header">
              <h3>Live Activity Feed</h3>
              <div className="activity-status">
                {isInteracting ? (
                  <div className="status-indicator active">
                    <div className="status-dot"></div>
                    <span>Live</span>
                  </div>
                ) : (
                  <div className="status-indicator inactive">
                    <div className="status-dot"></div>
                    <span>Idle</span>
                  </div>
                )}
              </div>
            </div>
            <div className="activity-feed">
              {activityLog.length === 0 ? (
                <div className="no-activity">
                  <div className="no-activity-icon">📱</div>
                  <p>No activity yet. Start automation to see live updates.</p>
                </div>
              ) : (
                <div className="activity-list">
                  {activityLog.map((activity) => (
                    <div key={activity.id} className={`activity-item ${activity.type}`}>
                      <div className="activity-icon">
                        {activity.type === 'like' && '👍'}
                        {activity.type === 'comment' && '💬'}
                        {activity.type === 'wait' && '⏱️'}
                        {activity.type === 'info' && 'ℹ️'}
                        {activity.type === 'error' && '❌'}
                      </div>
                      <div className="activity-content">
                        <div className="activity-message">{activity.message}</div>
                        {activity.details && (
                          <div className="activity-details">{activity.details}</div>
                        )}
                        <div className="activity-time">
                          {activity.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Comment History Section */}
          {showCommentHistory && (
            <div className="dashboard-card comment-history-card">
              <div className="card-header">
                <h3>Comment History ({comments.length})</h3>
                <button 
                  onClick={() => setShowCommentHistory(false)} 
                  className="close-btn"
                  style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
              <div className="comment-history-content">
                {comments.length === 0 ? (
                  <div className="no-comments">
                    <div className="no-comments-icon">💬</div>
                    <p>No comments yet. Start interacting with posts to see your comment history.</p>
                  </div>
                ) : (
                  <div className="comments-list">
                    {comments.map((comment) => (
                      <div key={comment._id} className="comment-item">
                        <div className="comment-header">
                          <div className="comment-meta">
                            <span className="comment-time">
                              {new Date(comment.timestamp).toLocaleString()}
                            </span>
                            {comment.postOwner && (
                              <span className="post-owner">
                                @{comment.postOwner}
                              </span>
                            )}
                            <a 
                              href={comment.postUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="post-link"
                            >
                              View Post 🔗
                            </a>
                          </div>
                          {!comment.isDeleted && (
                            <button
                              onClick={() => handleDeleteComment(comment._id)}
                              disabled={deletingCommentId === comment._id}
                              className="delete-comment-btn"
                            >
                              {deletingCommentId === comment._id ? 'Deleting...' : '🗑️ Delete'}
                            </button>
                          )}
                          {comment.isDeleted && (
                            <span className="deleted-badge">Deleted</span>
                          )}
                        </div>
                        <div className="comment-body">
                          <div className="post-caption">
                            <strong>Post:</strong> {comment.postCaption.substring(0, 150)}
                            {comment.postCaption.length > 150 && '...'}
                          </div>
                          <div className="comment-text">
                            <strong>Your Comment:</strong> {comment.commentText}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
        )}

        {/* Followers & DM Page */}
        {currentPage === 'followers' && (
          <div className="dashboard-grid">
            {/* Followers Stats */}
            <div className="dashboard-card followers-card">
              <div className="card-header">
                <h3>Followers Scraped</h3>
              </div>
              <div className="stats-content">
                <div className="stat-value">{followers.length}</div>
                <div className="stat-change">Recent</div>
              </div>
              <div className="recent-list">
                {followers.slice(0, 3).map((follower, i) => (
                  <div key={i} className="recent-item">
                    <div className="item-icon">👤</div>
                    <div className="item-name">{follower}</div>
                    <div className="item-value">New</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Follower Scraping */}
            <div className="dashboard-card scraping-card">
              <div className="card-header">
                <h3>Follower Scraping</h3>
              </div>
              <div className="card-content">
                <form onSubmit={handleScrapeFollowers} className="scraping-form">
                  <input
                    type="text"
                    placeholder="Target Account"
                    value={targetAccount}
                    onChange={(e) => setTargetAccount(e.target.value)}
                    required
                    disabled={loading}
                    className="scraping-input"
                  />
                  <input
                    type="number"
                    placeholder="Max Followers"
                    value={maxFollowers}
                    onChange={(e) => setMaxFollowers(Number(e.target.value))}
                    required
                    disabled={loading}
                    min="1"
                    className="scraping-input"
                  />
                  <button type="submit" disabled={loading} className="action-button">
                    Scrape Followers
                  </button>
                </form>
              </div>
            </div>

            {/* Direct Messages */}
            <div className="dashboard-card dm-card">
              <div className="card-header">
                <h3>Direct Messages</h3>
              </div>
              <div className="card-content">
                <div className="dm-form">
                  <input
                    type="text"
                    placeholder="Username"
                    value={dmUsername}
                    onChange={(e) => setDmUsername(e.target.value)}
                    disabled={loading}
                    className="dm-input"
                  />
                  <textarea
                    placeholder="Message"
                    value={dmMessage}
                    onChange={(e) => setDmMessage(e.target.value)}
                    disabled={loading}
                    rows={2}
                    className="dm-textarea"
                  />
                  <button 
                    type="button" 
                    onClick={handleSendDM} 
                    disabled={loading}
                    className="dm-button"
                  >
                    Send DM
                  </button>
                </div>
              </div>
            </div>

            {/* Followers List */}
          {followers.length > 0 && (
            <div className="dashboard-card followers-list-card">
              <div className="card-header">
                <h3>Scraped Followers ({followers.length})</h3>
                <div className="card-filter">This session</div>
              </div>
              <div className="followers-table">
                <div className="table-header">
                  <div className="table-cell">Username</div>
                  <div className="table-cell">Status</div>
                  <div className="table-cell">Action</div>
                </div>
                <div className="followers-scroll">
                  {followers.map((follower, i) => (
                    <div key={i} className="table-row">
                      <div className="table-cell">
                        <div className="user-info">
                          <div className="user-avatar">👤</div>
                          <span>{follower}</span>
                        </div>
                      </div>
                      <div className="table-cell">
                        <span className="status-badge">Active</span>
                      </div>
                      <div className="table-cell">
                        <button className="action-btn">DM</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Target Accounts Page */}
        {currentPage === 'targets' && (
          <div className="dashboard-grid">
            {/* Instructions Card */}
            <div className="dashboard-card" style={{ gridColumn: '1 / -1' }}>
              <div className="card-header">
                <h3>🎯 Select Target Accounts</h3>
                {targetAccounts.length > 0 && (
                  <div className="card-filter">
                    {targetAccounts.length} saved target{targetAccounts.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
              <div className="card-content">
                <p className="card-description">
                  Choose which accounts you want to auto-comment on. The bot will only interact with posts from selected accounts.
                </p>
                {targetAccounts.length > 0 && (
                  <div style={{ 
                    background: '#f0f9ff', 
                    border: '1px solid #0ea5e9', 
                    borderRadius: '8px', 
                    padding: '0.75rem', 
                    marginBottom: '1rem',
                    fontSize: '0.875rem',
                    color: '#0369a1'
                  }}>
                    💾 <strong>Saved Target Accounts:</strong> {targetAccounts.slice(0, 3).join(', ')}
                    {targetAccounts.length > 3 && ` and ${targetAccounts.length - 3} more...`}
                  </div>
                )}
                <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <button 
                    onClick={fetchFollowing} 
                    disabled={loadingFollowing || loading}
                    className="action-button"
                  >
                    {loadingFollowing ? 'Loading...' : `Load Following List (${following.length})`}
                  </button>
                  {following.length > 0 && (
                    <>
                      <button 
                        onClick={handleSelectAllTargets}
                        disabled={loading}
                        className="action-button"
                        style={{ background: '#10b981' }}
                      >
                        Select All
                      </button>
                      <button 
                        onClick={handleDeselectAllTargets}
                        disabled={loading}
                        className="action-button"
                        style={{ background: '#ef4444' }}
                      >
                        Deselect All
                      </button>
                      <button 
                        onClick={handleSaveTargetAccounts}
                        disabled={loading}
                        className="action-button"
                        style={{ background: '#3b82f6' }}
                      >
                        💾 Save Selection ({targetAccounts.length})
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Account Selection Grid */}
            {following.length > 0 && (
              <div className="dashboard-card" style={{ gridColumn: '1 / -1' }}>
                <div className="card-header">
                  <h3>Your Following ({following.length} accounts)</h3>
                  <div className="card-filter">{targetAccounts.length} selected</div>
                </div>
                <div className="target-accounts-grid">
                  {following.map((account) => (
                    <div
                      key={account}
                      className={`target-account-item ${targetAccounts.includes(account) ? 'selected' : ''}`}
                      onClick={() => handleToggleTargetAccount(account)}
                    >
                      <div className="account-checkbox">
                        {targetAccounts.includes(account) ? '✓' : ''}
                      </div>
                      <div className="account-info">
                        <div className="account-avatar">
                          {account.charAt(0).toUpperCase()}
                        </div>
                        <span className="account-username">@{account}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {following.length === 0 && (
              <div className="dashboard-card" style={{ gridColumn: '1 / -1' }}>
                <div className="card-content" style={{ textAlign: 'center', padding: '3rem' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</div>
                  <h3 style={{ marginBottom: '1rem', color: '#64748b' }}>No Following List Loaded</h3>
                  <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>
                    Click "Load Following List" to see accounts you're following on Instagram.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Growth Page - Follow/Unfollow */}
        {currentPage === 'growth' && (
          <div className="dashboard-grid">
            {/* Stats Overview */}
            <div className="dashboard-card stats-card">
              <div className="card-header">
                <h3>Total Followed</h3>
              </div>
              <div className="stats-content">
                <div className="stat-value">{followStats.totalFollowed}</div>
                <div className="stat-change">All time</div>
              </div>
            </div>

            <div className="dashboard-card stats-card">
              <div className="card-header">
                <h3>Followed Back</h3>
              </div>
              <div className="stats-content">
                <div className="stat-value">{followStats.followedBack}</div>
                <div className="stat-change">{followStats.conversionRate}% conversion</div>
              </div>
            </div>

            <div className="dashboard-card stats-card">
              <div className="card-header">
                <h3>Pending Unfollow</h3>
              </div>
              <div className="stats-content">
                <div className="stat-value">{followStats.pendingUnfollow}</div>
                <div className="stat-change">Currently following</div>
              </div>
            </div>

            <div className="dashboard-card stats-card">
              <div className="card-header">
                <h3>Today's Activity</h3>
              </div>
              <div className="stats-content">
                <div className="stat-value">
                  +{followStats.todayFollowed} / -{followStats.todayUnfollowed}
                </div>
                <div className="stat-change">Followed / Unfollowed</div>
              </div>
            </div>

            {/* Follow Campaign Controls */}
            <div className="dashboard-card" style={{ gridColumn: 'span 2' }}>
              <div className="card-header">
                <h3>📈 Follow Campaign</h3>
              </div>
              <div className="card-content">
                <p className="card-description">
                  Automatically follow users from your target accounts. The bot will follow users gradually to avoid detection.
                </p>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', margin: '1rem 0' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#64748b' }}>
                      Max Follows Per Session
                    </label>
                    <input
                      type="number"
                      value={maxFollowsPerSession}
                      onChange={(e) => setMaxFollowsPerSession(Number(e.target.value))}
                      min="1"
                      max="50"
                      className="scraping-input"
                      disabled={isFollowCampaignRunning || loading}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#64748b' }}>
                      Max Follows Per Day
                    </label>
                    <input
                      type="number"
                      value={maxFollowsPerDay}
                      onChange={(e) => setMaxFollowsPerDay(Number(e.target.value))}
                      min="1"
                      max="200"
                      className="scraping-input"
                      disabled={isFollowCampaignRunning || loading}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>
                    ℹ️ Using {targetAccounts.length} target account{targetAccounts.length !== 1 ? 's' : ''}
                    {targetAccounts.length === 0 && ' - Please set target accounts first!'}
                  </p>
                </div>

                {isFollowCampaignRunning ? (
                  <button 
                    onClick={handleStopFollowCampaign} 
                    disabled={loading}
                    className="action-button stop-button"
                    style={{ marginTop: '1rem' }}
                  >
                    Stop Follow Campaign
                  </button>
                ) : (
                  <button 
                    onClick={handleStartFollowCampaign} 
                    disabled={loading || targetAccounts.length === 0}
                    className="action-button"
                    style={{ marginTop: '1rem' }}
                  >
                    {loading ? 'Starting...' : 'Start Follow Campaign'}
                  </button>
                )}
              </div>
            </div>

            {/* Unfollow Campaign Controls */}
            <div className="dashboard-card" style={{ gridColumn: 'span 2' }}>
              <div className="card-header">
                <h3>📉 Unfollow Campaign</h3>
              </div>
              <div className="card-content">
                <p className="card-description">
                  Automatically unfollow users who haven't followed back after a set period. Clean up your following list.
                </p>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', margin: '1rem 0' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#64748b' }}>
                      Unfollow After (Days)
                    </label>
                    <input
                      type="number"
                      value={unfollowAfterDays}
                      onChange={(e) => setUnfollowAfterDays(Number(e.target.value))}
                      min="1"
                      max="30"
                      className="scraping-input"
                      disabled={loading}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={onlyUnfollowNonFollowers}
                        onChange={(e) => setOnlyUnfollowNonFollowers(e.target.checked)}
                        disabled={loading}
                        style={{ marginRight: '0.5rem' }}
                      />
                      <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                        Only unfollow non-followers
                      </span>
                    </label>
                  </div>
                </div>

                <button 
                  onClick={handleStartUnfollowCampaign} 
                  disabled={loading}
                  className="action-button"
                  style={{ marginTop: '1rem', background: '#ef4444' }}
                >
                  {loading ? 'Starting...' : 'Start Unfollow Campaign'}
                </button>
              </div>
            </div>

            {/* Check Follow-backs */}
            <div className="dashboard-card" style={{ gridColumn: '1 / -1' }}>
              <div className="card-header">
                <h3>🔍 Check Follow-Back Status</h3>
              </div>
              <div className="card-content">
                <p className="card-description">
                  Check which users you followed have followed you back. This helps identify who to unfollow.
                </p>
                <button 
                  onClick={handleCheckFollowBacks} 
                  disabled={loading}
                  className="action-button"
                  style={{ marginTop: '1rem', background: '#3b82f6' }}
                >
                  {loading ? 'Checking...' : 'Check Follow-Backs (20 users)'}
                </button>
              </div>
            </div>

            {/* Followed Users List */}
            <div className="dashboard-card" style={{ gridColumn: '1 / -1' }}>
              <div className="card-header">
                <h3>Recently Followed Users</h3>
                <div className="card-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    onClick={() => fetchFollowedUsers('all')}
                    className="action-btn"
                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                  >
                    All
                  </button>
                  <button 
                    onClick={() => fetchFollowedUsers('active')}
                    className="action-btn"
                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                  >
                    Active
                  </button>
                  <button 
                    onClick={() => fetchFollowedUsers('followed-back')}
                    className="action-btn"
                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                  >
                    Followed Back
                  </button>
                  <button 
                    onClick={() => fetchFollowedUsers('not-followed-back')}
                    className="action-btn"
                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                  >
                    Not Followed Back
                  </button>
                </div>
              </div>
              {followedUsers.length > 0 ? (
                <div className="followers-table">
                  <div className="table-header">
                    <div className="table-cell">Username</div>
                    <div className="table-cell">Followed At</div>
                    <div className="table-cell">Status</div>
                    <div className="table-cell">Source</div>
                  </div>
                  <div className="followers-scroll">
                    {followedUsers.map((user, i) => (
                      <div key={i} className="table-row">
                        <div className="table-cell">
                          <div className="user-info">
                            <div className="user-avatar">👤</div>
                            <span>@{user.username}</span>
                          </div>
                        </div>
                        <div className="table-cell">
                          {new Date(user.followedAt).toLocaleDateString()}
                        </div>
                        <div className="table-cell">
                          <span className={`status-badge ${user.followedBack ? 'success' : 'pending'}`}>
                            {user.unfollowedAt ? 'Unfollowed' : user.followedBack ? '✓ Followed Back' : 'Pending'}
                          </span>
                        </div>
                        <div className="table-cell">
                          {user.sourceAccount || 'N/A'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="card-content" style={{ textAlign: 'center', padding: '2rem' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📊</div>
                  <p style={{ color: '#94a3b8' }}>
                    No followed users yet. Start a follow campaign to see results here.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
