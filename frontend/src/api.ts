const API_BASE = '/api';

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
}; 