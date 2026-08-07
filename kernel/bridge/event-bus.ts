/**
 * Event Bus — the core pub/sub system for cross-mini-app communication.
 * 
 * ARCHITECTURE: This is a simple synchronous event bus. Events are dispatched
 * to all listeners registered for that event type. Each mini-app gets a
 * scoped view of the bus through the SDK, which enforces permissions.
 * 
 * SECURITY: The bus itself doesn't check permissions — that's done in the
 * SDK layer (sdk-factory.ts). This separation keeps the bus simple and testable.
 */

import { BridgeEvent, BridgeEventHandler, Unsubscribe } from '../../types/bridge';

type ListenerEntry = {
  appId: string;
  handler: BridgeEventHandler<BridgeEvent['type']>;
};

const listeners = new Map<string, ListenerEntry[]>();

/**
 * Subscribe to a bridge event.
 * @returns Unsubscribe function to remove this specific listener.
 */
export function subscribe<T extends BridgeEvent['type']>(
  appId: string,
  event: T,
  handler: BridgeEventHandler<T>
): Unsubscribe {
  const current = listeners.get(event) ?? [];
  const entry: ListenerEntry = {
    appId,
    handler: handler as BridgeEventHandler<BridgeEvent['type']>,
  };
  listeners.set(event, [...current, entry]);

  // Return unsubscribe function
  return () => {
    const entries = listeners.get(event);
    if (entries) {
      listeners.set(
        event,
        entries.filter((e) => e !== entry)
      );
    }
  };
}

/**
 * Emit an event to all listeners.
 * The event is dispatched synchronously to all subscribers.
 */
export function emit<T extends BridgeEvent['type']>(
  event: T,
  payload: Extract<BridgeEvent, { type: T }>['payload']
): void {
  const entries = listeners.get(event) ?? [];
  for (const entry of entries) {
    try {
      entry.handler(payload as Parameters<typeof entry.handler>[0]);
    } catch (error: unknown) {
      // FAULT ISOLATION: A listener throwing must not crash other listeners or the emitter.
      console.error(
        `[EventBus] Error in listener for '${event}' from app '${entry.appId}':`,
        error
      );
    }
  }
}

/** Remove all listeners for a specific mini-app (cleanup on unmount) */
export function removeAllListeners(appId: string): void {
  for (const [event, entries] of listeners.entries()) {
    listeners.set(
      event,
      entries.filter((e) => e.appId !== appId)
    );
  }
}
