"use client";

/**
 * lib/RealmContext.tsx
 * Contexto global de MongoDB Realm para Xiimalab
 * Maneja autenticación y conexión a la base de datos en tiempo real
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { initRealmServices } from "@/lib/realm/initRealm";
import { AuthService, IRealmUser } from "@/lib/realm/RealmService";
import { MongoService } from "@/lib/realm/MongoService";

interface RealmContextValue {
  currentUser: IRealmUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  loginAnonymous: () => Promise<boolean>;
  logout: () => Promise<void>;
  mongoService: MongoService | null;
}

const RealmContext = createContext<RealmContextValue | null>(null);

export function RealmProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<IRealmUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mongoService, setMongoService] = useState<MongoService | null>(null);

  // Initialize Realm services
  useEffect(() => {
    const initializeRealm = async () => {
      try {
        setIsLoading(true);
        const { authService, mongoService } = initRealmServices();
        setMongoService(mongoService);

        // Subscribe to auth state changes
        const subscription = authService.getCurrentUser().subscribe({
          next: (user) => {
            setCurrentUser(user);
            setIsAuthenticated(!!user && user.isLoggedIn);
            setIsLoading(false);
          },
          error: (err) => {
            setError(err.message);
            setIsLoading(false);
          }
        });

        // Clean up subscription on unmount
        return () => subscription.unsubscribe();
      } catch (err: any) {
        setError(err.message);
        setIsLoading(false);
      }
    };

    initializeRealm();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setError(null);
      setIsLoading(true);

      const authService = AuthService.getInstance();
      await authService.login({ email, password });

      setIsLoading(false);
      return true;
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
      return false;
    }
  };

  const loginAnonymous = async (): Promise<boolean> => {
    try {
      setError(null);
      setIsLoading(true);

      const authService = AuthService.getInstance();
      await authService.loginAnonymous();

      setIsLoading(false);
      return true;
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setError(null);
      setIsLoading(true);

      const authService = AuthService.getInstance();
      await authService.logout();

      setIsLoading(false);
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <RealmContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        isLoading,
        error,
        login,
        loginAnonymous,
        logout,
        mongoService,
      }}
    >
      {children}
    </RealmContext.Provider>
  );
}

export function useRealm() {
  const ctx = useContext(RealmContext);
  if (!ctx) throw new Error("useRealm must be used within <RealmProvider>");
  return ctx;
}