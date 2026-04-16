import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Re-sync user data from server periodically
  const syncUser = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await axios.get(`${API}/users/${user.id}`);
      if (res.data) {
        const synced = { ...user, ...res.data };
        setUser(synced);
        localStorage.setItem('user', JSON.stringify(synced));
      }
    } catch (e) { /* server unreachable, keep local */ }
  }, [user?.id]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    // Sync every 10 seconds to keep coins/diamonds accurate
    const interval = setInterval(syncUser, 10000);
    return () => clearInterval(interval);
  }, [isAuthenticated, user?.id, syncUser]);

  // Restore session from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.id) {
          setUser(parsed);
          setIsAuthenticated(true);
          // Immediately sync with server on restore
          axios.get(`${API}/users/${parsed.id}`).then(res => {
            if (res.data) {
              const synced = { ...parsed, ...res.data };
              setUser(synced);
              localStorage.setItem('user', JSON.stringify(synced));
            }
          }).catch(() => {});
        }
      } catch (e) { localStorage.removeItem('user'); }
    }
  }, []);

  const login = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('user');
  };

  const updateUser = (updates) => {
    const updated = { ...user, ...updates };
    setUser(updated);
    localStorage.setItem('user', JSON.stringify(updated));
  };

  return (
    <UserContext.Provider value={{ user, isAuthenticated, login, logout, updateUser, syncUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);