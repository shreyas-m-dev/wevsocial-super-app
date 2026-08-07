/**
 * Auth Store — Zustand store managing authentication state.
 * 
 * ARCHITECTURE: Uses expo-secure-store for token persistence (never AsyncStorage for tokens).
 * Handles login, register, token refresh, and logout.
 * The access token has a 15-minute expiry; the refresh token 7 days.
 * Silent refresh happens automatically via the API client on 401.
 */

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { UserDTO, AuthTokensDTO } from '../../types/api';
import { ScopedUser } from '../../types/sdk';

const API_BASE_URL = __DEV__
  ? 'http://10.0.2.2:3000/api'
  : 'http://localhost:3000/api';

const SECURE_STORE_ACCESS_TOKEN = 'wev_access_token';
const SECURE_STORE_REFRESH_TOKEN = 'wev_refresh_token';

interface AuthState {
  /** Current user profile, null if not authenticated */
  user: UserDTO | null;
  /** JWT access token (short-lived, 15min) */
  accessToken: string | null;
  /** Refresh token (long-lived, 7d) */
  refreshToken: string | null;
  /** Whether we're currently loading/checking auth state */
  isLoading: boolean;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<boolean>;
  loadStoredTokens: () => Promise<void>;
  getScopedUser: () => Promise<ScopedUser | null>;
}

/**
 * Helper to parse JSON response and narrow the type.
 * Uses unknown + type guard to avoid any.
 */
async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text) as unknown;
}

/** Type guard for AuthTokensDTO shape */
function isAuthTokensDTO(value: unknown): value is AuthTokensDTO {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['accessToken'] === 'string' &&
    typeof obj['refreshToken'] === 'string' &&
    typeof obj['user'] === 'object' && obj['user'] !== null
  );
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: true,
  isAuthenticated: false,

  /**
   * Login with email + password.
   * Stores tokens in expo-secure-store (encrypted at rest on device).
   */
  login: async (email: string, password: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await parseJsonResponse(response);
      const message =
        typeof errorData === 'object' && errorData !== null && 'message' in errorData
          ? String((errorData as Record<string, unknown>)['message'])
          : 'Login failed';
      throw new Error(message);
    }

    const data = await parseJsonResponse(response);
    if (!isAuthTokensDTO(data)) {
      throw new Error('Invalid response from server');
    }

    // Persist tokens securely
    await SecureStore.setItemAsync(SECURE_STORE_ACCESS_TOKEN, data.accessToken);
    await SecureStore.setItemAsync(SECURE_STORE_REFRESH_TOKEN, data.refreshToken);

    set({
      user: data.user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  /**
   * Register a new account.
   */
  register: async (email: string, password: string, displayName?: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    });

    if (!response.ok) {
      const errorData = await parseJsonResponse(response);
      const message =
        typeof errorData === 'object' && errorData !== null && 'message' in errorData
          ? String((errorData as Record<string, unknown>)['message'])
          : 'Registration failed';
      throw new Error(message);
    }

    const data = await parseJsonResponse(response);
    if (!isAuthTokensDTO(data)) {
      throw new Error('Invalid response from server');
    }

    await SecureStore.setItemAsync(SECURE_STORE_ACCESS_TOKEN, data.accessToken);
    await SecureStore.setItemAsync(SECURE_STORE_REFRESH_TOKEN, data.refreshToken);

    set({
      user: data.user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  /**
   * Logout — revoke refresh token server-side and clear local state.
   */
  logout: async (): Promise<void> => {
    const { refreshToken: token } = get();
    
    // Best-effort server-side revocation
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: token }),
        });
      } catch {
        // Swallow — we're logging out regardless
      }
    }

    // Clear secure storage
    await SecureStore.deleteItemAsync(SECURE_STORE_ACCESS_TOKEN);
    await SecureStore.deleteItemAsync(SECURE_STORE_REFRESH_TOKEN);

    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  /**
   * Silent token refresh — called automatically on 401.
   * Rotates the refresh token (old one is revoked server-side).
   * Returns true if refresh succeeded, false otherwise.
   */
  refreshTokens: async (): Promise<boolean> => {
    const { refreshToken: currentRefreshToken } = get();
    if (!currentRefreshToken) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: currentRefreshToken }),
      });

      if (!response.ok) {
        // Refresh token is invalid/expired — force logout
        await get().logout();
        return false;
      }

      const data = await parseJsonResponse(response);
      if (!isAuthTokensDTO(data)) {
        await get().logout();
        return false;
      }

      await SecureStore.setItemAsync(SECURE_STORE_ACCESS_TOKEN, data.accessToken);
      await SecureStore.setItemAsync(SECURE_STORE_REFRESH_TOKEN, data.refreshToken);

      set({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        isAuthenticated: true,
      });

      return true;
    } catch {
      await get().logout();
      return false;
    }
  },

  /**
   * Load stored tokens on app startup.
   * Attempts to refresh if tokens exist — validates they're still valid.
   */
  loadStoredTokens: async (): Promise<void> => {
    try {
      const accessToken = await SecureStore.getItemAsync(SECURE_STORE_ACCESS_TOKEN);
      const refreshToken = await SecureStore.getItemAsync(SECURE_STORE_REFRESH_TOKEN);

      if (!accessToken || !refreshToken) {
        set({ isLoading: false });
        return;
      }

      // Try to use the access token to get the current user
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.ok) {
        const userData = await parseJsonResponse(response);
        if (typeof userData === 'object' && userData !== null) {
          set({
            user: userData as UserDTO,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        }
      }

      // Access token expired — try refresh
      set({ accessToken, refreshToken });
      const refreshed = await get().refreshTokens();
      if (!refreshed) {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  /**
   * Get the current user as a ScopedUser (for the bridge SDK).
   */
  getScopedUser: async (): Promise<ScopedUser | null> => {
    const { user } = get();
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    };
  },
}));
