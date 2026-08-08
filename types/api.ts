/**
 * API Response DTOs — typed contracts between frontend and backend.
 * UI components never call the API directly; these types flow through repository classes.
 */

// ---- Auth ----
export interface UserDTO {
  id: string;
  email: string;
  displayName: string | null;
  role: 'GUEST' | 'HOST' | 'ADMIN';
  createdAt: string;
}

export interface AuthTokensDTO {
  accessToken: string;
  refreshToken: string;
  user: UserDTO;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string;
}

// ---- Sports ----
export interface SportsActivityDTO {
  id: string;
  title: string;
  sportType: string;
  description: string | null;
  locationName: string | null;
  lat: number | null;
  lng: number | null;
  startTime: string;
  endTime: string;
  maxParticipants: number;
  currentParticipants: number;
  hostId: string;
  createdAt: string;
}

export interface SportsBookingDTO {
  id: string;
  activityId: string;
  userId: string;
  status: BookingStatus;
  idempotencyKey: string | null;
  createdAt: string;
}

export interface CreateSportsBookingRequest {
  idempotencyKey: string;
}

// ---- Care ----
/** Provider as returned by API — NEVER contains real lat/lng unless confirmed booking */
export interface CareProviderDTO {
  id: string;
  name: string;
  bio: string | null;
  obfuscatedLat: number;
  obfuscatedLng: number;
  services: string[];
  hourlyRate: string | number | null;
  verified: boolean;
  /** Only present when user has a CONFIRMED booking */
  realLat?: number;
  /** Only present when user has a CONFIRMED booking */
  realLng?: number;
}

export interface CareBookingDTO {
  id: string;
  provider: {
    id: string;
    name: string;
    obfuscatedLat: number;
    obfuscatedLng: number;
    realLat?: number;
    realLng?: number;
  };
  startTime: string;
  endTime: string;
  status: BookingStatus;
  address: string | null;
  createdAt: string;
}

export interface CreateCareBookingRequest {
  providerId: string;
  startTime: string;
  endTime: string;
  address?: string;
}

// ---- Events ----
export interface EventDTO {
  id: string;
  title: string;
  description: string | null;
  locationName: string | null;
  startTime: string | null;
  hostId: string;
  createdAt: string;
}

// ---- Shared ----
export type BookingStatus = 'CONFIRMED' | 'PENDING' | 'PENDING_SYNC' | 'CANCELLED' | 'CONFLICT_REJECTED';

/** Offline booking queue state machine */
export type BookingSyncState = 'IDLE' | 'QUEUED' | 'SYNCING' | 'SUCCESS' | 'CONFLICT_REJECTED';

export interface ApiError {
  error: string;
  message?: string;
  details?: unknown;
}
