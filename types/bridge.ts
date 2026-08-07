/**
 * Bridge Event Payloads — typed contracts for cross-mini-app communication.
 * Every event that flows through wev.bridge must be typed here.
 */

/** Event emitted when a sports session is booked */
export interface SportsBookingEvent {
  type: 'sports:session_booked';
  payload: {
    activityId: string;
    activityTitle: string;
    sportType: string;
    startTime: string; // ISO 8601
    endTime: string;   // ISO 8601
    locationName: string;
  };
}

/** Event emitted when care needs to be suggested for a time window */
export interface CareNeededEvent {
  type: 'care:needed_for_window';
  payload: {
    startTime: string;
    endTime: string;
    reason: string;
  };
}

/** Generic navigation request across mini-apps (goes through kernel) */
export interface CrossNavEvent {
  type: 'nav:cross_app';
  payload: {
    targetApp: string;
    targetRoute: string;
    params?: Record<string, string>;
  };
}

/** Union of all bridge events */
export type BridgeEvent = SportsBookingEvent | CareNeededEvent | CrossNavEvent;

/** Extract payload type from an event type string */
export type BridgeEventPayload<T extends BridgeEvent['type']> =
  Extract<BridgeEvent, { type: T }>['payload'];

/** Handler function for bridge events */
export type BridgeEventHandler<T extends BridgeEvent['type'] = BridgeEvent['type']> =
  (payload: BridgeEventPayload<T>) => void;

/** Unsubscribe function returned by bridge.on() */
export type Unsubscribe = () => void;
