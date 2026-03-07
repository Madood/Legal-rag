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

function clearToken() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('isAuthenticated');
  localStorage.removeItem('userType');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'));
  const [isLoading, setIsLoading] = useState(true);

  // On mount, try to restore session from stored token
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    if (!storedToken) {
      setIsLoading(false);
      return;
    }
    apiClient
      .get('/auth/me', { headers: { Authorization: `Bearer ${storedToken}` } })
      .then((res) => {
        if (res.data?.success) {
          setUser(res.data.data.user);
          setToken(storedToken);
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
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('userType', 'guest');
    setToken(t);
    setUser(u);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiClient.post('/auth/login', { email, password });
    const { user: u, token: t } = res.data.data;
    saveToken(t);
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('userType', 'authenticated');
    setToken(t);
    setUser(u);
  }, []);

  const register = useCallback(async (username: string, email: string, password: string, tier = 'pro') => {
    const res = await apiClient.post('/auth/register', { username, email, password, tier });
    const { user: u, token: t } = res.data.data;
    saveToken(t);
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
      if (res.data?.success) setUser(res.data.data.user);
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
