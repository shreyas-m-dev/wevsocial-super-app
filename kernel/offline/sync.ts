/**
 * Sync Manager — processes the offline queue when connectivity returns.
 * 
 * Uses NetInfo to detect connectivity changes. When the device goes online,
 * processes all QUEUED items in FIFO order, one at a time.
 * 
 * 409 CONFLICT HANDLING:
 * If the server returns 409, the item transitions to CONFLICT_REJECTED.
 * The optimistic UI is rolled back and the user is notified via toast.
 */

import NetInfo from '@react-native-community/netinfo';
import { apiRequest, ApiError } from '../api/client';
import {
  getPendingItems,
  updateItemStatus,
  clearCompleted,
  loadQueue,
  QueueItem,
  SportsBookingPayload,
  CareBookingPayload,
} from './queue';

let isSyncing = false;
let unsubscribeNetInfo: (() => void) | null = null;

/**
 * Process a single queue item — send it to the backend.
 */
async function processItem(item: QueueItem): Promise<void> {
  await updateItemStatus(item.id, 'SYNCING');

  try {
    if (item.bookingType === 'sports') {
      const payload = item.payload as SportsBookingPayload;
      await apiRequest(`/sports/${payload.activityId}/book`, {
        method: 'POST',
        body: { idempotencyKey: item.idempotencyKey },
      });
    } else {
      const payload = item.payload as CareBookingPayload;
      await apiRequest('/care/bookings', {
        method: 'POST',
        body: {
          providerId: payload.providerId,
          startTime: payload.startTime,
          endTime: payload.endTime,
          address: payload.address,
        },
      });
    }

    await updateItemStatus(item.id, 'SUCCESS');
  } catch (error: unknown) {
    if (error instanceof ApiError && error.status === 409) {
      // CONFLICT: Slot already booked. Transition to CONFLICT_REJECTED.
      await updateItemStatus(item.id, 'CONFLICT_REJECTED', error.message);
    } else {
      // Network or server error — reset to QUEUED for retry
      await updateItemStatus(item.id, 'QUEUED', 
        error instanceof Error ? error.message : 'Unknown error');
    }
  }
}

/**
 * Process all pending items in FIFO order.
 * Called when connectivity is restored.
 */
async function processQueue(): Promise<void> {
  if (isSyncing) return;
  isSyncing = true;

  try {
    const pending = getPendingItems();
    
    // Process in FIFO order, one at a time
    for (const item of pending) {
      await processItem(item);
    }

    // Clean up successful items
    await clearCompleted();
  } finally {
    isSyncing = false;
  }
}

/**
 * Start the sync manager — listens for connectivity changes.
 * Call this once on app startup.
 */
export async function startSyncManager(): Promise<void> {
  // Load persisted queue (crash recovery)
  await loadQueue();

  // Listen for connectivity changes
  unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      // Device just came online — process queue
      processQueue().catch((error: unknown) => {
        console.error('[SyncManager] Error processing queue:', error);
      });
    }
  });

  // Also try to process immediately if we're already online
  const currentState = await NetInfo.fetch();
  if (currentState.isConnected) {
    processQueue().catch((error: unknown) => {
      console.error('[SyncManager] Error processing queue:', error);
    });
  }
}

/** Stop the sync manager */
export function stopSyncManager(): void {
  if (unsubscribeNetInfo) {
    unsubscribeNetInfo();
    unsubscribeNetInfo = null;
  }
}
