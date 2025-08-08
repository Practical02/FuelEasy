import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "./queryClient";

interface User {
  id: string;
  username: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include"
        });
        if (!response.ok) {
          if (response.status === 401) {
            return null;
          }
          throw new Error("Failed to fetch user");
        }
        const data = await response.json();
        return data.user;
      } catch (error) {
        // For PWA offline scenarios, check if we have cached user data
        if (!navigator.onLine) {
          const cachedUser = localStorage.getItem('fuelflow_user');
          if (cachedUser) {
            try {
              return JSON.parse(cachedUser);
            } catch {
              return null;
            }
          }
        }
        return null;
      }
    },
    retry: (failureCount, error: any) => {
      // Don't retry if offline or unauthorized
      if (!navigator.onLine || error?.status === 401) {
        return false;
      }
      return failureCount < 3;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (was cacheTime)
  });

  const loginMutation = useMutation({
    mutationFn: async ({ username, password, rememberMe }: { username: string; password: string; rememberMe?: boolean }) => {
      const response = await apiRequest("POST", "/api/auth/login", { username, password, rememberMe });
      return response.json();
    },
    onSuccess: (data) => {
      // Cache user data locally for PWA offline access
      localStorage.setItem('fuelflow_user', JSON.stringify(data.user));
      queryClient.setQueryData(["/api/auth/me"], data.user);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    }
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      // Clear cached user data
      localStorage.removeItem('fuelflow_user');
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.clear();
      window.location.href = "/login";
    }
  });

  const login = async (username: string, password: string, rememberMe?: boolean) => {
    await loginMutation.mutateAsync({ username, password, rememberMe });
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  const isAuthenticated = !!user && !error;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = "/login";
    return null;
  }

  return <>{children}</>;
}