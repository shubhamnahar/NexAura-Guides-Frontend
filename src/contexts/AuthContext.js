// src/AuthContext.js
// This is a simple context to hold auth state in React.
// For now, we'll just check chrome.storage on load.
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if token exists on load
    if (window.chrome && window.chrome.storage) {
      window.chrome.storage.local.get("nexaura_token", (result) => {
        if (result.nexaura_token) {
          setToken(result.nexaura_token);
        }
        setLoading(false);
      });
    } else {
        const localToken = localStorage.getItem("nexaura_token");
        if (localToken) {
            setToken(localToken);
        }
        setLoading(false);
    }
  }, []);

  const login = (newToken) => {
    setToken(newToken);
    // Storage is set in LoginPage
  };

  const logout = () => {
    setToken(null);
    if (window.chrome && window.chrome.storage) {
      window.chrome.storage.local.remove("nexaura_token");
    } else {
      localStorage.removeItem("nexaura_token");
    }
  };

  return (
    <AuthContext.Provider value={{ token, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);