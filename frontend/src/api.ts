// Use environment variable for API base URL, fallback to VPS for production
// Updated to point to VPS backend for proper API communication
// Note: Using HTTPS to avoid mixed content issues with Vercel HTTPS frontend
// Force Vercel redeploy with HTTPS backend URL
// Force redeploy - HTTPS backend URL (without port 3001 for Nginx proxy)
const API_BASE = 'https://147.93.126.228/api';

// Debug: Log the API_BASE to console to see what's being used
console.log('API_BASE:', API_BASE);
console.log('VITE_API_URL env var:', import.meta.env.VITE_API_URL);

export interface LoginRequest {
  username: string;
  password: string;
}

export interface DMRequest {
  username: string;
  message: string;
}

export interface ScrapeFollowersRequest {
  targetAccount: string;
  maxFollowers: number;
}

export interface Comment {
  _id: string;
  username: string;
  postUrl: string;
  postCaption: string;
  commentText: string;
  postOwner?: string;
  timestamp: string;
  isDeleted: boolean;
  deletedAt?: string;
}

export interface CommentStats {
  total: number;
  deleted: number;
  today: number;
}

export interface FollowUnfollowStats {
  totalFollowed: number;
  totalUnfollowed: number;
  followedBack: number;
  pendingUnfollow: number;
  todayFollowed: number;
  todayUnfollowed: number;
  conversionRate: number;
}

export interface FollowedUser {
  username: string;
  followedAt: string;
  unfollowedAt?: string;
  followedBack: boolean;
  shouldUnfollow: boolean;
  sourceAccount?: string;
  notes?: string;
}

export interface FollowCampaignConfig {
  targetAccounts: string[];
  maxFollowsPerDay?: number;
  maxFollowsPerSession?: number;
  unfollowAfterDays?: number;
  onlyUnfollowNonFollowers?: boolean;
  delayBetweenFollows?: { min: number; max: number };
  skipIfAlreadyFollowing?: boolean;
}

export interface UnfollowCampaignConfig {
  maxUnfollowsPerSession?: number;
  unfollowAfterDays?: number;
  onlyUnfollowNonFollowers?: boolean;
  delayBetweenUnfollows?: { min: number; max: number };
}

export const api = {
  // Auth endpoints
  login: async (data: LoginRequest) => {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Login failed');
    return res.json();
  },

  logout: async () => {
    const res = await fetch(`${API_BASE}/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Logout failed');
    return res.json();
  },

  getMe: async () => {
    const res = await fetch(`${API_BASE}/me`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Not authenticated');
    return res.json();
  },

  getStatus: async () => {
    const res = await fetch(`${API_BASE}/status`);
    if (!res.ok) throw new Error('Failed to get status');
    return res.json();
  },

  // Instagram actions
  interact: async () => {
    const res = await fetch(`${API_BASE}/interact`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Interaction failed');
    return res.json();
  },

  stopInteractions: async () => {
    const res = await fetch(`${API_BASE}/exit-interactions`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to stop interactions');
    return res.json();
  },

  sendDM: async (data: DMRequest) => {
    const res = await fetch(`${API_BASE}/dm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to send DM');
    return res.json();
  },

  scrapeFollowers: async (data: ScrapeFollowersRequest) => {
    const res = await fetch(`${API_BASE}/scrape-followers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to scrape followers');
    return res.json();
  },

  clearCookies: async () => {
    const res = await fetch(`${API_BASE}/clear-cookies`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to clear cookies');
    return res.json();
  },

  // Comment endpoints
  getComments: async (params?: { limit?: number; skip?: number; includeDeleted?: boolean }) => {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.skip) queryParams.append('skip', params.skip.toString());
    if (params?.includeDeleted) queryParams.append('includeDeleted', 'true');
    
    const res = await fetch(`${API_BASE}/comments?${queryParams}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch comments');
    return res.json() as Promise<{
      success: boolean;
      comments: Comment[];
      total: number;
      limit: number;
      skip: number;
    }>;
  },

  deleteComment: async (commentId: string) => {
    const res = await fetch(`${API_BASE}/comments/${commentId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to delete comment');
    return res.json();
  },

  getCommentStats: async () => {
    const res = await fetch(`${API_BASE}/comments/stats`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch comment stats');
    return res.json() as Promise<{
      success: boolean;
      stats: CommentStats;
    }>;
  },

  // Target Accounts endpoints
  getFollowing: async (maxFollowing: number = 100) => {
    const res = await fetch(`${API_BASE}/following?maxFollowing=${maxFollowing}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch following list');
    return res.json() as Promise<{
      success: boolean;
      following: string[];
      total: number;
    }>;
  },

  getTargetAccounts: async () => {
    const res = await fetch(`${API_BASE}/target-accounts`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch target accounts');
    return res.json() as Promise<{
      success: boolean;
      targetAccounts: string[];
    }>;
  },

  updateTargetAccounts: async (targetAccounts: string[]) => {
    const res = await fetch(`${API_BASE}/target-accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetAccounts }),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to update target accounts');
    return res.json();
  },

  // Follow/Unfollow endpoints
  startFollowCampaign: async (config: FollowCampaignConfig) => {
    const res = await fetch(`${API_BASE}/follow-campaign/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to start follow campaign');
    return res.json();
  },

  stopFollowCampaign: async () => {
    const res = await fetch(`${API_BASE}/follow-campaign/stop`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to stop follow campaign');
    return res.json();
  },

  startUnfollowCampaign: async (config: UnfollowCampaignConfig) => {
    const res = await fetch(`${API_BASE}/unfollow-campaign/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to start unfollow campaign');
    return res.json();
  },

  checkFollowBacks: async (maxToCheck: number = 20) => {
    const res = await fetch(`${API_BASE}/follow-campaign/check-followbacks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxToCheck }),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to check follow-backs');
    return res.json();
  },

  getFollowStats: async () => {
    const res = await fetch(`${API_BASE}/follow-stats`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch follow stats');
    return res.json() as Promise<{
      success: boolean;
      stats: FollowUnfollowStats;
    }>;
  },

  getFollowedUsers: async (filter: string = 'all', limit: number = 50) => {
    const res = await fetch(`${API_BASE}/followed-users?filter=${filter}&limit=${limit}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch followed users');
    return res.json() as Promise<{
      success: boolean;
      users: FollowedUser[];
      total: number;
    }>;
  },
}; 