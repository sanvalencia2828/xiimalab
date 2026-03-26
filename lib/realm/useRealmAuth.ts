// lib/realm/useRealmAuth.ts
// React hook for MongoDB Realm authentication in Xiimalab

import { useEffect, useState } from 'react';
import { AuthService, IAuthCredentials } from './AuthService';
import { IRealmUser } from './RealmService';

/**
 * React hook for MongoDB Realm authentication
 * Provides authentication state and methods for login/logout
 */
export function useRealmAuth() {
  const [authService] = useState(() => AuthService.getInstance());
  const [currentUser, setCurrentUser] = useState<IRealmUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to auth state changes
  useEffect(() => {
    const subscription = authService.getCurrentUser().subscribe({
      next: (user) => {
        setCurrentUser(user);
        setIsLoading(false);
      },
      error: (err) => {
        setError(err.message);
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [authService]);

  // Login with email and password
  const login = async (credentials: IAuthCredentials): Promise<boolean> => {
    try {
      setError(null);
      setIsLoading(true);
      await authService.login(credentials);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Anonymous login
  const loginAnonymous = async (): Promise<boolean> => {
    try {
      setError(null);
      setIsLoading(true);
      await authService.loginAnonymous();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout
  const logout = async (): Promise<boolean> => {
    try {
      setError(null);
      setIsLoading(true);
      await authService.logout();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Check if user is authenticated
  const isAuthenticated = (): boolean => {
    return !!currentUser && currentUser.isLoggedIn;
  };

  return {
    currentUser,
    isLoading,
    error,
    login,
    loginAnonymous,
    logout,
    isAuthenticated
  };
}