import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';
import { authProvider } from '../utils/firebase';
import type { UserSessionProfile } from '../utils/firebase';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  loginWithProvider: (provider: 'GOOGLE' | 'GITHUB' | 'APPLE' | 'EMAIL', email?: string, password?: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const decodeToken = (token: string) => {
  try {
    const parts = token.split('.');
    let payloadPart = parts[1];
    if (token.startsWith('mock_token_')) {
      const stripped = token.substring(11);
      payloadPart = stripped.split('.')[1];
    }
    if (!payloadPart) return null;
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Failed to decode token:', error);
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const getStorage = () => {
    return localStorage.getItem('vitora_remember_me') === 'false' ? sessionStorage : localStorage;
  };

  useEffect(() => {
    // Bind session listener
    const unsubscribe = authProvider.onSessionStateChanged(async (session: UserSessionProfile | null) => {
      setLoading(true);
      if (!session) {
        setUser(null);
        setToken(null);
        localStorage.removeItem('vitora_token');
        sessionStorage.removeItem('vitora_token');
        setLoading(false);
        return;
      }

      try {
        const storage = getStorage();
        storage.setItem('vitora_token', session.idToken);
        setToken(session.idToken);
        
        // Sync with local database (the backend authMiddleware will auto-create or update user profile)
        const response = await api.post('/auth/sync', {}, {
          headers: { Authorization: `Bearer ${session.idToken}` }
        });
        
        setUser(response.data.user);
      } catch (error) {
        console.error('Session sync failed:', error);
        // Clear session on sync failure to prevent broken state
        setUser(null);
        setToken(null);
        localStorage.removeItem('vitora_token');
        sessionStorage.removeItem('vitora_token');
        await authProvider.logoutSession();
      } finally {
        setLoading(false);
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  // Background token expiration and refresh orchestration
  useEffect(() => {
    if (!token) return;

    const checkAndRefreshSession = async () => {
      const decoded = decodeToken(token);
      if (!decoded || !decoded.exp) return;

      const expTime = decoded.exp * 1000;
      const timeRemaining = expTime - Date.now();

      // If token has expired or will expire in less than 5 minutes, trigger automated refresh
      if (timeRemaining < 300000) {
        console.log('Token nearing expiration, attempting refresh...');
        try {
          const freshToken = await authProvider.refreshToken();
          if (freshToken) {
            const storage = getStorage();
            storage.setItem('vitora_token', freshToken);
            setToken(freshToken);
            
            // Sync refreshed token context with database
            const response = await api.post('/auth/sync', {}, {
              headers: { Authorization: `Bearer ${freshToken}` }
            });
            setUser(response.data.user);
          } else {
            throw new Error('Refresh token failure');
          }
        } catch (err) {
          console.error('Background session refresh failed. Forced logout initiated.', err);
          await logout();
        }
      }
    };

    checkAndRefreshSession();
    const interval = setInterval(checkAndRefreshSession, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [token]);

  const loginWithProvider = async (provider: 'GOOGLE' | 'GITHUB' | 'APPLE' | 'EMAIL', email?: string, password?: string) => {
    setLoading(true);
    try {
      if (provider === 'GOOGLE') {
        await authProvider.continueWithGoogle();
      } else if (provider === 'GITHUB') {
        await authProvider.continueWithGithub();
      } else if (provider === 'APPLE') {
        await authProvider.continueWithApple();
      } else if (provider === 'EMAIL') {
        if (!email || !password) throw new Error('Email and password required');
        await authProvider.continueWithEmail(email, password);
      }
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const registerWithEmail = async (email: string, pass: string, name: string) => {
    setLoading(true);
    try {
      await authProvider.registerWithEmail(email, pass, name);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      const currentToken = token || localStorage.getItem('vitora_token') || sessionStorage.getItem('vitora_token');
      if (currentToken) {
        await api.post('/auth/logout', {}, {
          headers: { Authorization: `Bearer ${currentToken}` }
        }).catch((e) => console.warn('Failed to audit logout on server:', e));
      }
    } catch (error) {
      console.warn('Backend session termination failed:', error);
    }

    try {
      await authProvider.logoutSession();
      localStorage.removeItem('vitora_token');
      sessionStorage.removeItem('vitora_token');
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, loginWithProvider, registerWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
