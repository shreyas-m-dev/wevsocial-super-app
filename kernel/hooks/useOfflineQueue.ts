/**
 * Hook for components to observe the offline queue.
 */
import { useState, useEffect, useCallback } from 'react';
import { getQueueItems, onQueueChange, QueueItem } from '../offline/queue';

export function useOfflineQueue(): {
  items: ReadonlyArray<QueueItem>;
  pendingCount: number;
  hasConflicts: boolean;
} {
  const [items, setItems] = useState<ReadonlyArray<QueueItem>>(getQueueItems());

  useEffect(() => {
    const unsubscribe = onQueueChange(() => {
      setItems([...getQueueItems()]);
    });
    return unsubscribe;
  }, []);

  const pendingCount = items.filter((i) => i.status === 'QUEUED' || i.status === 'SYNCING').length;
  const hasConflicts = items.some((i) => i.status === 'CONFLICT_REJECTED');

  return { items, pendingCount, hasConflicts };
}
