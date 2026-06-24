import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from './api';

export const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);

  const checkAuth = async () => {
    try {
      const res = await apiFetch(`/auth/me`);
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        setConnectionError(false);
      } else if (res.status === 401) {
        setUser(null);
        setConnectionError(false);
      } else {
        // 5xx errors
        setConnectionError(true);
      }
    } catch (err) {
      // Network errors (backend down)
      setConnectionError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email, password) => {
    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);

    const res = await apiFetch(`/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.access_token) {
        localStorage.setItem("access_token", data.access_token);
      }
      await checkAuth();
      return true;
    }
    return false;
  };

  const register = async (email, password) => {
    const res = await apiFetch(`/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      return login(email, password);
    }
    const err = await res.json();
    throw new Error(err.detail || 'Error en registro');
  };

  const logout = async () => {
    localStorage.removeItem("access_token");
    await apiFetch(`/auth/logout`, { method: 'POST' });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, connectionError, login, register, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};
