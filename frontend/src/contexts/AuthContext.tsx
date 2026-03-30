import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAuthToken } from '../utils/api';

interface User { id: string; email: string; name: string; role: string; }

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, token: null, isLoading: true,
  login: async () => {}, register: async () => {}, logout: async () => {},
});

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const stored = await AsyncStorage.getItem('access_token');
      if (stored) {
        setAuthToken(stored);
        const res = await fetch(`${BASE_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${stored}` } });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user); setToken(stored);
        } else {
          await AsyncStorage.multiRemove(['access_token', 'refresh_token']);
          setAuthToken(null);
        }
      }
    } catch (e) { console.error('restore session error', e); }
    finally { setIsLoading(false); }
  };

  const login = async (email: string, password: string) => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Login gagal' }));
      throw new Error(typeof err.detail === 'string' ? err.detail : 'Login gagal');
    }
    const data = await res.json();
    await AsyncStorage.setItem('access_token', data.access_token);
    await AsyncStorage.setItem('refresh_token', data.refresh_token);
    setAuthToken(data.access_token);
    setUser(data.user); setToken(data.access_token);
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Registrasi gagal' }));
      throw new Error(typeof err.detail === 'string' ? err.detail : 'Registrasi gagal');
    }
    const data = await res.json();
    await AsyncStorage.setItem('access_token', data.access_token);
    await AsyncStorage.setItem('refresh_token', data.refresh_token);
    setAuthToken(data.access_token);
    setUser(data.user); setToken(data.access_token);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['access_token', 'refresh_token']);
    setAuthToken(null);
    setUser(null); setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
