/**
 * Offline Booking Queue — persists booking requests when offline.
 * 
 * ARCHITECTURE DECISION: AsyncStorage over SQLite.
 * Trade-offs documented in ARCHITECTURE.md:
 * - AsyncStorage: Simpler API, no native module linking, sufficient for queue use case.
 *   Max item size ~2MB is more than enough for booking queue metadata.
 * - SQLite: Better for complex queries, transactions. Overkill for a simple FIFO queue.
 * 
 * STATE MACHINE:
 * IDLE → QUEUED (user creates booking while offline)
 * QUEUED → SYNCING (network comes back, queue starts processing)
 * SYNCING → SUCCESS (server accepted the booking)
 * SYNCING → CONFLICT_REJECTED (server returned 409 — double booking)
 * 
 * CRASH RECOVERY:
 * Queue items are persisted to AsyncStorage immediately on creation.
 * On app restart, loadQueue() reads persisted items and resumes processing.
 * Items in SYNCING state are reset to QUEUED (assume the request didn't complete).
 * 
 * DEDUPLICATION:
 * Each queue item has an idempotencyKey (UUID v4 generated client-side).
 * The backend uses this key to prevent duplicate bookings — if a request
 * with the same idempotencyKey arrives twice, the server returns the
 * existing booking instead of creating a new one.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type QueueItemStatus = 'QUEUED' | 'SYNCING' | 'SUCCESS' | 'CONFLICT_REJECTED';

export type BookingType = 'sports' | 'care';

export interface QueueItem {
  /** Unique ID for this queue entry */
  id: string;
  /** Idempotency key sent to the backend for dedup */
  idempotencyKey: string;
  /** Type of booking */
  bookingType: BookingType;
  /** The booking payload to send to the server */
  payload: SportsBookingPayload | CareBookingPayload;
  /** Current state in the sync state machine */
  status: QueueItemStatus;
  /** ISO timestamp when queued */
  queuedAt: string;
  /** Number of sync attempts */
  retryCount: number;
  /** Error message if CONFLICT_REJECTED */
  errorMessage?: string;
}

export interface SportsBookingPayload {
  activityId: string;
  /** For display purposes while offline */
  activityTitle: string;
}

export interface CareBookingPayload {
  providerId: string;
  startTime: string;
  endTime: string;
  address?: string;
  /** For display purposes while offline */
  providerName: string;
}

const QUEUE_STORAGE_KEY = '@wev:offline_queue';
const MAX_RETRIES = 3;

let queueItems: QueueItem[] = [];
let listeners: Array<() => void> = [];

/** Subscribe to queue changes */
export function onQueueChange(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** Persist queue to AsyncStorage */
async function persistQueue(): Promise<void> {
  await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queueItems));
}

/** Type guard for QueueItem array */
function isQueueItemArray(value: unknown): value is QueueItem[] {
  if (!Array.isArray(value)) return false;
  return value.every((item: unknown) => {
    if (typeof item !== 'object' || item === null) return false;
    const obj = item as Record<string, unknown>;
    return (
      typeof obj['id'] === 'string' &&
      typeof obj['idempotencyKey'] === 'string' &&
      typeof obj['bookingType'] === 'string' &&
      typeof obj['status'] === 'string' &&
      typeof obj['payload'] === 'object'
    );
  });
}

/**
 * Load queue from AsyncStorage on app startup.
 * CRASH RECOVERY: Items stuck in SYNCING are reset to QUEUED.
 */
export async function loadQueue(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isQueueItemArray(parsed)) {
        queueItems = parsed.map((item) => ({
          ...item,
          // CRASH RECOVERY: Reset SYNCING items to QUEUED
          // If the app crashed during sync, we can't know if the request succeeded.
          // The idempotencyKey ensures the backend won't create a duplicate.
          status: item.status === 'SYNCING' ? 'QUEUED' : item.status,
        }));
      }
    }
  } catch (error: unknown) {
    console.error('[OfflineQueue] Failed to load queue:', error);
    queueItems = [];
  }
}

/** Generate a UUID v4 idempotency key */
function generateIdempotencyKey(): string {
  // Simple UUID v4 generation without external dependency
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Add a booking to the offline queue.
 * DEDUP: Checks for existing items with same composite key.
 */
export async function enqueue(
  bookingType: BookingType,
  payload: SportsBookingPayload | CareBookingPayload
): Promise<QueueItem> {
  // Generate composite dedup key based on booking type + payload
  const dedupKey = bookingType === 'sports'
    ? `sports:${(payload as SportsBookingPayload).activityId}`
    : `care:${(payload as CareBookingPayload).providerId}:${(payload as CareBookingPayload).startTime}`;

  // Check for duplicates — only QUEUED items (not already processed)
  const existingIndex = queueItems.findIndex(
    (item) => {
      if (item.status !== 'QUEUED') return false;
      if (item.bookingType !== bookingType) return false;
      if (bookingType === 'sports') {
        return (item.payload as SportsBookingPayload).activityId ===
          (payload as SportsBookingPayload).activityId;
      }
      const itemPayload = item.payload as CareBookingPayload;
      const newPayload = payload as CareBookingPayload;
      return itemPayload.providerId === newPayload.providerId &&
        itemPayload.startTime === newPayload.startTime;
    }
  );

  if (existingIndex !== -1) {
    // Return existing item instead of creating duplicate
    return queueItems[existingIndex]!;
  }

  const item: QueueItem = {
    id: generateIdempotencyKey(),
    idempotencyKey: generateIdempotencyKey(),
    bookingType,
    payload,
    status: 'QUEUED',
    queuedAt: new Date().toISOString(),
    retryCount: 0,
  };

  queueItems.push(item);
  await persistQueue();
  notifyListeners();
  return item;
}

/** Get all items currently in the queue */
export function getQueueItems(): ReadonlyArray<QueueItem> {
  return queueItems;
}

/** Get pending (QUEUED) items in FIFO order */
export function getPendingItems(): QueueItem[] {
  return queueItems
    .filter((item) => item.status === 'QUEUED')
    .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
}

/** Update a queue item's status */
export async function updateItemStatus(
  id: string,
  status: QueueItemStatus,
  errorMessage?: string
): Promise<void> {
  const index = queueItems.findIndex((item) => item.id === id);
  if (index === -1) return;

  const item = queueItems[index]!;
  queueItems[index] = {
    ...item,
    status,
    retryCount: status === 'SYNCING' ? item.retryCount + 1 : item.retryCount,
    errorMessage,
  };

  await persistQueue();
  notifyListeners();
}

/** Remove successfully synced items from the queue */
export async function clearCompleted(): Promise<void> {
  queueItems = queueItems.filter(
    (item) => item.status !== 'SUCCESS'
  );
  await persistQueue();
  notifyListeners();
}

/** Check if an item should be retried */
export function shouldRetry(item: QueueItem): boolean {
  return item.retryCount < MAX_RETRIES && item.status === 'QUEUED';
}
