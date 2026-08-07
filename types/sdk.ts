/**
 * WevSDK — the capability boundary injected into each mini-app.
 * This is the ONLY interface a mini-app has to the host shell.
 * No other path to host state, native APIs, or other mini-apps' storage.
 */

import { PermissionScope } from './manifest';
import { BridgeEvent, BridgeEventHandler, Unsubscribe } from './bridge';
import { UserDTO } from './api';

/** Scoped user profile — may omit fields the mini-app doesn't have permission for */
export interface ScopedUser {
  id: string;
  email: string;
  displayName: string | null;
  role: 'GUEST' | 'HOST' | 'ADMIN';
}

export interface WevAuth {
  /** Get the current user profile, scoped to what this mini-app may see */
  getUser(): Promise<ScopedUser | null>;
}

export interface WevStorage {
  /** Get a value from namespaced storage (mini-app isolated) */
  get(key: string): Promise<unknown>;
  /** Set a value in namespaced storage (mini-app isolated) */
  set(key: string, val: unknown): Promise<void>;
}

export interface WevNav {
  /** Navigate within the calling mini-app's own stack */
  navigate(target: string, params?: Record<string, string>): void;
}

export interface WevBridge {
  /** Emit an event to the bridge (other mini-apps can listen) */
  emit<T extends BridgeEvent['type']>(
    event: T,
    payload: Extract<BridgeEvent, { type: T }>['payload']
  ): void;
  /** Listen for an event on the bridge */
  on<T extends BridgeEvent['type']>(
    event: T,
    handler: BridgeEventHandler<T>
  ): Unsubscribe;
}

export interface WevPermissions {
  /** Request a permission scope. Returns 'granted' or 'denied'. */
  request(scope: PermissionScope): Promise<'granted' | 'denied'>;
  /** Check if a permission is currently granted */
  has(scope: PermissionScope): boolean;
}

/** The complete SDK injected into each mini-app */
export interface WevSDK {
  auth: WevAuth;
  storage: WevStorage;
  nav: WevNav;
  bridge: WevBridge;
  permissions: WevPermissions;
  /** The mini-app's own ID, for reference */
  appId: string;
}
