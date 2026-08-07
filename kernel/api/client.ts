/**
 * API Client — typed HTTP client for backend communication.
 * 
 * ARCHITECTURE: This is the sole interface between the mobile app and the backend.
 * UI components NEVER call this directly — they go through repository hooks.
 * The client handles token attachment and silent refresh on 401.
 */

import { useAuthStore } from '../stores/auth';

import { Platform } from 'react-native';

const API_BASE_URL = Platform.OS === 'web'
  ? 'http://localhost:3000/api'
  : (__DEV__ ? 'http://10.0.2.2:3000/api' : 'http://localhost:3000/api');

// Also try for physical device / iOS simulator
export const getApiBaseUrl = (): string => {
  return API_BASE_URL;
};

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  /** If true, skip auth token attachment */
  skipAuth?: boolean;
}

interface ApiResponse<T> {
  data: T;
  status: number;
}

/**
 * Core fetch wrapper with:
 * - Automatic auth token attachment
 * - Silent refresh on 401 (one retry)
 * - Typed responses
 * - Error standardization
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, headers = {}, skipAuth = false } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  // Attach access token if available and not skipped
  if (!skipAuth) {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  const url = `${getApiBaseUrl()}${endpoint}`;

  let response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  /**
   * SILENT REFRESH: If we get a 401, attempt to refresh the access token
   * using the refresh token, then retry the original request exactly once.
   * This prevents the user from being logged out on every token expiry.
   */
  if (response.status === 401 && !skipAuth) {
    const refreshed = await useAuthStore.getState().refreshTokens();
    if (refreshed) {
      // Retry with the new token
      const newToken = useAuthStore.getState().accessToken;
      if (newToken) {
        requestHeaders['Authorization'] = `Bearer ${newToken}`;
      }
      response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });
    }
  }

  const responseData: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new ApiError(
      response.status,
      isApiErrorResponse(responseData)
        ? responseData.message ?? responseData.error
        : `Request failed with status ${response.status}`
    );
    throw error;
  }

  return { data: responseData as T, status: response.status };
}

/** Type guard for API error responses */
function isApiErrorResponse(
  value: unknown
): value is { error: string; message?: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as Record<string, unknown>)['error'] === 'string'
  );
}

/** Custom error class for API errors */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
