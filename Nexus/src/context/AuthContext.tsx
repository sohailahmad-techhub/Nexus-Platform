import React, { createContext, useState, useContext, useEffect } from 'react';
import { User, UserRole, AuthContextType } from '../types';
import { api } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';
import toast from 'react-hot-toast';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'business_nexus_token';
const USER_KEY = 'business_nexus_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load stored auth session on startup
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    
    if (storedToken && storedUser) {
      const parsedUser = JSON.parse(storedUser) as User;
      setUser(parsedUser);
      connectSocket(parsedUser.id);
      
      // Silent background validation and updates
      api.get(`/auth/profile/${parsedUser.id}`)
        .then((res) => {
          setUser(res.data);
          localStorage.setItem(USER_KEY, JSON.stringify(res.data));
        })
        .catch((err) => {
          console.warn('Session check failed, logging out:', err);
          // If token expired or invalid, log out
          if (err.response && (err.response.status === 401 || err.response.status === 403)) {
            logout();
          }
        });
    }
    setIsLoading(false);
  }, []);

  // Monitor user state changes to connect/disconnect socket
  useEffect(() => {
    if (user) {
      connectSocket(user.id);
    } else {
      disconnectSocket();
    }
  }, [user]);

  const login = async (email: string, password: string, role: UserRole) => {
    setIsLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password, role });
      
      if (res.data.require2FA) {
        toast.success('2FA verification code sent! Check console logs.');
        return {
          require2FA: true,
          userId: res.data.userId,
          email: res.data.email
        };
      }

      const { token, user: loggedUser } = res.data;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(loggedUser));
      setUser(loggedUser);
      
      toast.success('Successfully logged in!');
      return { require2FA: false };
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Login failed';
      toast.error(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOTP = async (userId: string, code: string) => {
    setIsLoading(true);
    try {
      const res = await api.post('/auth/verify-2fa', { userId, code });
      const { token, user: loggedUser } = res.data;
      
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(loggedUser));
      setUser(loggedUser);
      
      toast.success('Successfully verified and logged in!');
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Invalid 2FA code';
      toast.error(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string, role: UserRole) => {
    setIsLoading(true);
    try {
      const res = await api.post('/auth/register', { name, email, password, role });
      const { token, user: registeredUser } = res.data;
      
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(registeredUser));
      setUser(registeredUser);
      
      toast.success('Account created successfully!');
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Registration failed';
      toast.error(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const forgotPassword = async (email: string) => {
    // Basic mock notification as we don't have active senders
    toast.success(`Instructions sent to ${email} (simulated)`);
  };

  const resetPassword = async (token: string, newPassword: string) => {
    toast.success('Password reset successfully (simulated)');
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    disconnectSocket();
    toast.success('Logged out successfully');
  };

  const updateProfile = async (userId: string, updates: Partial<User>) => {
    try {
      const res = await api.put(`/auth/profile/${userId}`, updates);
      localStorage.setItem(USER_KEY, JSON.stringify(res.data));
      setUser(res.data);
      toast.success('Profile updated successfully');
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Failed to update profile';
      toast.error(msg);
      throw new Error(msg);
    }
  };

  const toggle2FA = async (enable: boolean): Promise<boolean> => {
    try {
      const res = await api.post('/auth/toggle-2fa', { enable });
      if (user) {
        const updatedUser = { ...user, twoFactorEnabled: res.data.twoFactorEnabled };
        setUser(updatedUser);
        localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
      }
      toast.success(res.data.message);
      return res.data.twoFactorEnabled;
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Failed to update 2FA configuration';
      toast.error(msg);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    updateProfile,
    verifyOTP,
    toggle2FA,
    isAuthenticated: !!user,
    isLoading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};