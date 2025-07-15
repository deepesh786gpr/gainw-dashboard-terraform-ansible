import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  emailVerified: boolean;
  role: {
    id: string;
    name: string;
    description?: string;
    permissions: string[];
  };
  lastLogin?: string;
  loginCount: number;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

interface AuthContextType {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  // Load tokens from localStorage on mount
  useEffect(() => {
    const savedTokens = localStorage.getItem('auth_tokens');
    if (savedTokens) {
      try {
        const parsedTokens = JSON.parse(savedTokens);
        setTokens(parsedTokens);
        // Verify token and get user info
        verifyTokenAndGetUser(parsedTokens.accessToken);
      } catch (error) {
        console.error('Error parsing saved tokens:', error);
        localStorage.removeItem('auth_tokens');
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  // Auto-refresh token before expiry
  useEffect(() => {
    if (tokens) {
      const expiryTime = new Date(tokens.expiresAt).getTime();
      const currentTime = Date.now();
      const timeUntilExpiry = expiryTime - currentTime;
      
      // Refresh 5 minutes before expiry
      const refreshTime = Math.max(0, timeUntilExpiry - 5 * 60 * 1000);
      
      const timeoutId = setTimeout(() => {
        refreshToken();
      }, refreshTime);

      return () => clearTimeout(timeoutId);
    }
  }, [tokens]);

  const verifyTokenAndGetUser = async (accessToken: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        // Token is invalid, clear it
        localStorage.removeItem('auth_tokens');
        setTokens(null);
        setUser(null);
      }
    } catch (error) {
      console.error('Error verifying token:', error);
      localStorage.removeItem('auth_tokens');
      setTokens(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string, rememberMe: boolean = false) => {
    setIsLoading(true);
    try {
      console.log(`Attempting to login with API URL: ${API_BASE_URL}`);
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password, rememberMe }),
      });

      console.log('Login response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Login error response:', errorText);
        let errorMessage = 'Login failed';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          console.error('Error parsing error response:', e);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Login successful, user data received');
      
      setUser(data.user);
      setTokens(data.tokens);
      
      // Save tokens to localStorage
      localStorage.setItem('auth_tokens', JSON.stringify(data.tokens));
      console.log('Auth tokens saved to localStorage');
      
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (tokens?.accessToken) {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local state regardless of API call success
      setUser(null);
      setTokens(null);
      localStorage.removeItem('auth_tokens');
    }
  };

  const refreshToken = async () => {
    if (!tokens?.refreshToken) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        setTokens(data.tokens);
        localStorage.setItem('auth_tokens', JSON.stringify(data.tokens));
      } else {
        // Refresh failed, logout user
        await logout();
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      await logout();
    }
  };

  const hasPermission = (permission: string): boolean => {
    return user?.role?.permissions?.includes(permission) || false;
  };

  const hasRole = (role: string): boolean => {
    return user?.role?.id === role || false;
  };

  const hasAnyPermission = (permissions: string[]): boolean => {
    if (!permissions || permissions.length === 0) return false;
    return permissions.some(permission => hasPermission(permission));
  };

  const hasAllPermissions = (permissions: string[]): boolean => {
    if (!permissions || permissions.length === 0) return true;
    return permissions.every(permission => hasPermission(permission));
  };

  const value: AuthContextType = {
    user,
    tokens,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    refreshToken,
    hasPermission,
    hasRole,
    hasAnyPermission,
    hasAllPermissions,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
