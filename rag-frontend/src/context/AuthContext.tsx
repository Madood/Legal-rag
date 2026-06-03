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

const OFFLINE_GUEST_TOKEN = 'guest-offline';
const GUEST_STARTING_TOKENS = 30;
const GUEST_QUERY_COST = 3;

/** Decode JWT expiry locally — no network needed */
function isTokenExpired(token: string): boolean {
  if (token === OFFLINE_GUEST_TOKEN) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? Date.now() > payload.exp * 1000 : false;
  } catch {
    return true;
  }
}

function makeOfflineGuest(): AuthUser {
  return {
    id: 'offline-guest',
    username: 'Gast',
    email: '',
    isGuest: true,
    tier: 'guest',
    tokens: { balance: GUEST_STARTING_TOKENS, used: 0, resetAt: null },
    sessionTokensUsed: 0,
  };
}

function normalizeOfflineGuest(user: AuthUser): AuthUser {
  const balance = user.tokens?.balance ?? 0;
  const used = user.tokens?.used ?? 0;
  const total = balance + used;
  if (total >= GUEST_STARTING_TOKENS) return user;

  return {
    ...user,
    tokens: {
      ...user.tokens,
      balance: balance + (GUEST_STARTING_TOKENS - total),
      used,
      resetAt: null,
    },
  };
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

    // Fast path: offline guest — restore from cache, skip network entirely
    if (storedToken === OFFLINE_GUEST_TOKEN) {
      const cachedRaw = localStorage.getItem('user_cache');
      if (cachedRaw) {
        try {
          const cached = normalizeOfflineGuest(JSON.parse(cachedRaw) as AuthUser);
          setUser(cached);
          cacheUser(cached);
        } catch {
          setUser(makeOfflineGuest());
        }
      } else {
        setUser(makeOfflineGuest());
      }
      setToken(storedToken);
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
    try {
      const res = await apiClient.post('/auth/guest');
      const { user: u, token: t } = res.data.data;
      saveToken(t);
      cacheUser(u);
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userType', 'guest');
      setToken(t);
      setUser(u);
    } catch {
      // MongoDB unavailable — allow offline guest access
      const offlineGuest = makeOfflineGuest();
      localStorage.setItem('auth_token', OFFLINE_GUEST_TOKEN);
      cacheUser(offlineGuest);
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userType', 'guest');
      setToken(OFFLINE_GUEST_TOKEN);
      setUser(offlineGuest);
    }
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

    if (stored === OFFLINE_GUEST_TOKEN) {
      setUser((current) => {
        const guest = current || makeOfflineGuest();
        const updated = {
          ...guest,
          tokens: {
            ...guest.tokens,
            balance: Math.max(0, (guest.tokens.balance ?? GUEST_STARTING_TOKENS) - GUEST_QUERY_COST),
            used: (guest.tokens.used ?? 0) + GUEST_QUERY_COST,
          },
          sessionTokensUsed: (guest.sessionTokensUsed ?? 0) + GUEST_QUERY_COST,
        };
        cacheUser(updated);
        return updated;
      });
      return;
    }

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
