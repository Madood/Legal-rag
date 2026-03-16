import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { apiClient } from '../services/client';

export interface TokenInfo {
  balance: number;
  used: number;
  resetAt: string | null;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  isGuest: boolean;
  tier: 'guest' | 'pro' | 'business';
  tokens: TokenInfo;
  sessionTokensUsed: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  continueAsGuest: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, tier?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

function saveToken(token: string) {
  localStorage.setItem('auth_token', token);
}

function cacheUser(user: AuthUser) {
  localStorage.setItem('user_cache', JSON.stringify(user));
}

function clearToken() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user_cache');
  localStorage.removeItem('isAuthenticated');
  localStorage.removeItem('userType');
}

/** Decode JWT expiry locally — no network needed */
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? Date.now() > payload.exp * 1000 : false;
  } catch {
    return true;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [token, setToken]     = useState<string | null>(() => localStorage.getItem('auth_token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');

    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    // Fast path: token is expired — clear immediately, no network call
    if (isTokenExpired(storedToken)) {
      clearToken();
      setIsLoading(false);
      return;
    }

    // Fast path: cached user available — restore instantly, verify in background
    const cachedRaw = localStorage.getItem('user_cache');
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw) as AuthUser;
        setUser(cached);
        setToken(storedToken);
        setIsLoading(false); // UI unblocks immediately

        // Background verification — silently refresh user data
        apiClient
          .get('/auth/me', { headers: { Authorization: `Bearer ${storedToken}` } })
          .then((res) => {
            if (res.data?.success) {
              setUser(res.data.data.user);
              cacheUser(res.data.data.user);
            } else {
              clearToken();
              setUser(null);
              setToken(null);
            }
          })
          .catch(() => {
            // Network down or server down — keep cached user, don't log out
          });
        return;
      } catch {
        // Corrupt cache — fall through to server verification
      }
    }

    // Slow path: no cache — must hit server
    apiClient
      .get('/auth/me', { headers: { Authorization: `Bearer ${storedToken}` } })
      .then((res) => {
        if (res.data?.success) {
          setUser(res.data.data.user);
          setToken(storedToken);
          cacheUser(res.data.data.user);
        } else {
          clearToken();
        }
      })
      .catch(() => clearToken())
      .finally(() => setIsLoading(false));
  }, []);

  const continueAsGuest = useCallback(async () => {
    const res = await apiClient.post('/auth/guest');
    const { user: u, token: t } = res.data.data;
    saveToken(t);
    cacheUser(u);
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('userType', 'guest');
    setToken(t);
    setUser(u);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiClient.post('/auth/login', { email, password });
    const { user: u, token: t } = res.data.data;
    saveToken(t);
    cacheUser(u);
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('userType', 'authenticated');
    setToken(t);
    setUser(u);
  }, []);

  const register = useCallback(async (username: string, email: string, password: string, tier = 'pro') => {
    const res = await apiClient.post('/auth/register', { username, email, password, tier });
    const { user: u, token: t } = res.data.data;
    saveToken(t);
    cacheUser(u);
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('userType', 'authenticated');
    setToken(t);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const stored = localStorage.getItem('auth_token');
    if (!stored) return;
    try {
      const res = await apiClient.get('/auth/me', {
        headers: { Authorization: `Bearer ${stored}` },
      });
      if (res.data?.success) {
        setUser(res.data.data.user);
        cacheUser(res.data.data.user);
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, continueAsGuest, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
