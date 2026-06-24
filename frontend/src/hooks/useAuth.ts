import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import authService from '../services/authService';

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

// Session duration: 3 days in milliseconds
const SESSION_DURATION = 3 * 24 * 60 * 60 * 1000;

const isSessionExpired = (): boolean => {
  const timestamp = localStorage.getItem('sessionTimestamp');
  if (!timestamp) return true;
  const sessionTime = parseInt(timestamp, 10);
  return Date.now() - sessionTime > SESSION_DURATION;
};

const clearSession = (): void => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  localStorage.removeItem('sessionTimestamp');
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('authToken');
      const savedUser = localStorage.getItem('user');
      
      // Check session expiry first
      if (token && savedUser) {
        if (isSessionExpired()) {
          clearSession();
          setIsLoading(false);
          return;
        }

        try {
          const { valid, user: verifiedUser } = await authService.verifyToken();
          if (valid) {
            setUser(verifiedUser || JSON.parse(savedUser));
          } else {
            clearSession();
          }
        } catch (error) {
          clearSession();
        }
      }
      
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  // Periodic check for session expiry (every 60 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      if (user && isSessionExpired()) {
        clearSession();
        setUser(null);
        window.location.href = '/login';
      }
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [user]);

  const login = async (email: string, password: string) => {
    const response = await authService.login({ email, password });
    
    localStorage.setItem('authToken', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));
    localStorage.setItem('sessionTimestamp', Date.now().toString());
    setUser(response.user);
  };

  const logout = () => {
    clearSession();
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    setUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};