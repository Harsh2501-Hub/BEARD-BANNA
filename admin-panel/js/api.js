// =========================================================
// BEARD-BANNA CENTRAL API CLIENT
// Connects Frontend UI with Node.js Express Backend (Port 5000)
// =========================================================

const isLocalEnv = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const API_BASE_URL = isLocalEnv
  ? 'http://localhost:5000/api/v1'
  : (window.BACKEND_API_URL || 'https://beard-banna-backend.onrender.com/api/v1');

const API = {
  baseUrl: API_BASE_URL,

  // Token management
  getToken: () => localStorage.getItem('authToken'),
  setToken: (token) => localStorage.getItem('authToken') ? localStorage.setItem('authToken', token) : localStorage.setItem('authToken', token),
  removeToken: () => localStorage.removeItem('authToken'),

  // User session management
  getCurrentUser: () => {
    try {
      const user = localStorage.getItem('currentUser');
      return user ? JSON.parse(user) : null;
    } catch (e) {
      return null;
    }
  },
  setCurrentUser: (user) => localStorage.setItem('currentUser', JSON.stringify(user)),
  removeCurrentUser: () => localStorage.removeItem('currentUser'),

  // Admin session management
  getAdminToken: () => localStorage.getItem('adminToken') || localStorage.getItem('authToken'),
  setAdminToken: (token) => localStorage.setItem('adminToken', token),
  removeAdminToken: () => localStorage.removeItem('adminToken'),

  // Universal fetch wrapper with 3s timeout guard
  async fetch(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Attach token if present
    const token = options.isAdmin ? (this.getAdminToken() || this.getToken()) : this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || 10000); // 10s timeout guard

    const config = {
      ...options,
      headers,
      signal: controller.signal
    };

    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      clearTimeout(timeoutId);
      const data = await response.json().catch(() => ({ success: false, message: 'Invalid JSON response from server' }));

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}: Request failed`);
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      console.warn(`[API Client Warning] endpoint: ${endpoint} -> ${error.name === 'AbortError' ? 'Timeout (2.5s limit)' : error.message}`);
      throw error;
    }
  },

  // HTTP Helper Methods
  get(endpoint, options = {}) {
    return this.fetch(endpoint, { ...options, method: 'GET' });
  },

  post(endpoint, body, options = {}) {
    return this.fetch(endpoint, { ...options, method: 'POST', body });
  },

  put(endpoint, body, options = {}) {
    return this.fetch(endpoint, { ...options, method: 'PUT', body });
  },

  delete(endpoint, options = {}) {
    return this.fetch(endpoint, { ...options, method: 'DELETE' });
  }
};

window.API = API;
