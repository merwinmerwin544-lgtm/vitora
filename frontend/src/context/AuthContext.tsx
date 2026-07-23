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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Bind session listener
    const unsubscribe = authProvider.onSessionStateChanged(async (session: UserSessionProfile | null) => {
      setLoading(true);
      if (!session) {
        setUser(null);
        setToken(null);
        localStorage.removeItem('vitora_token');
        setLoading(false);
        return;
      }

      try {
        localStorage.setItem('vitora_token', session.idToken);
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
      await authProvider.logoutSession();
      localStorage.removeItem('vitora_token');
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
