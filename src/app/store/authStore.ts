// src/app/store/authStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Permission {
  code: string;
}

export interface Role {
  name: string;
  permissions: Permission[];
}

export interface CurrentUser {
  id: string;
  tenant_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  roles: Role[];
  department: string | null;
  specialization: string | null;
  tenant_name?: string | null;  // Hospital name
  must_change_password?: boolean;  // Flag for first-login forced password change
}

interface AuthState {
  token: string | null;
  user: CurrentUser | null;

  setToken: (token: string | null) => void;
  setUser: (user: CurrentUser | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,

      setToken: (token) => set(() => ({ token })),

      setUser: (user) => set(() => ({ user })),

      logout: () =>
        set(() => ({
          token: null,
          user: null,
        })),
    }),
    {
      name: "auth-storage",
      // Only persist token and user, not permissions (derive from user.roles)
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
    }
  )
);