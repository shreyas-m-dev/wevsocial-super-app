/**
 * SDK Factory — creates a scoped, permission-gated WevSDK instance for each mini-app.
 * 
 * SECURITY: This is the capability boundary. Each mini-app receives ONLY this SDK object.
 * Every method checks permissions BEFORE executing. If a mini-app tries to call an SDK
 * method without the required permission, the call is rejected INSIDE the bridge,
 * before any network request or storage access occurs.
 * 
 * ARCHITECTURE: The factory creates a new SDK instance per mini-app mount.
 * Each instance is bound to the mini-app's ID, so storage is namespaced
 * and permissions are enforced per-app.
 */

import { WevSDK, ScopedUser } from '../../types/sdk';
import { BridgeEvent, BridgeEventHandler, Unsubscribe } from '../../types/bridge';
import { PermissionScope } from '../../types/manifest';
import { hasPermission, requestPermission } from '../permissions';
import * as eventBus from './event-bus';
import AsyncStorage from '@react-native-async-storage/async-storage';

// We'll set this from the auth store when creating the SDK
type UserGetter = () => Promise<ScopedUser | null>;

// Navigation callback type — injected by the shell
type NavigationCallback = (target: string, params?: Record<string, string>) => void;

/**
 * Creates a permission-gated SDK instance for a specific mini-app.
 * 
 * @param appId - The mini-app's unique identifier
 * @param getUser - Function to retrieve the current user (injected by auth layer)
 * @param onNavigate - Navigation callback (injected by shell, scoped to this app)
 */
export function createSDK(
  appId: string,
  getUser: UserGetter,
  onNavigate: NavigationCallback
): WevSDK {
  /**
   * Helper: check permission and throw if denied.
   * SECURITY: Called at the top of every SDK method. This ensures that
   * permission checks happen INSIDE the bridge, before any side effects.
   */
  function assertPermission(scope: PermissionScope, operation: string): void {
    if (!hasPermission(appId, scope)) {
      throw new Error(
        `[WevSDK] Permission denied: App '${appId}' lacks '${scope}' for operation '${operation}'. ` +
        `Request this permission in your manifest's requiredPermissions array.`
      );
    }
  }

  /**
   * STORAGE NAMESPACE KEY
   * SECURITY: Each mini-app's storage is prefixed with its appId.
   * This prevents Sports from reading Care's keys (or vice versa).
   * The namespace is enforced at the SDK level — there's no way for a
   * mini-app to access raw AsyncStorage without going through this SDK.
   */
  function namespacedKey(key: string): string {
    return `@wev:${appId}:${key}`;
  }

  const sdk: WevSDK = {
    appId,

    auth: {
      async getUser(): Promise<ScopedUser | null> {
        // SECURITY: Check auth:read permission before returning user data
        assertPermission('auth:read', 'auth.getUser');
        return getUser();
      },
    },

    storage: {
      async get(key: string): Promise<unknown> {
        // SECURITY: Check storage:read before accessing namespaced storage
        assertPermission('storage:read', 'storage.get');
        const raw = await AsyncStorage.getItem(namespacedKey(key));
        if (raw === null) return null;
        try {
          return JSON.parse(raw) as unknown;
        } catch {
          return raw;
        }
      },

      async set(key: string, val: unknown): Promise<void> {
        // SECURITY: Check storage:write before writing to namespaced storage
        assertPermission('storage:write', 'storage.set');
        await AsyncStorage.setItem(namespacedKey(key), JSON.stringify(val));
      },
    },

    nav: {
      navigate(target: string, params?: Record<string, string>): void {
        // SECURITY: Navigation is confined to the calling mini-app's own stack
        assertPermission('nav:internal', 'nav.navigate');
        onNavigate(target, params);
      },
    },

    bridge: {
      emit<T extends BridgeEvent['type']>(
        event: T,
        payload: Extract<BridgeEvent, { type: T }>['payload']
      ): void {
        // SECURITY: Check bridge:emit permission before publishing events
        assertPermission('bridge:emit', 'bridge.emit');
        console.log(`[WevSDK] App '${appId}' emitting '${event}'`);
        eventBus.emit(event, payload);
      },

      on<T extends BridgeEvent['type']>(
        event: T,
        handler: BridgeEventHandler<T>
      ): Unsubscribe {
        // SECURITY: Check bridge:listen permission before subscribing
        assertPermission('bridge:listen', 'bridge.on');
        return eventBus.subscribe(appId, event, handler);
      },
    },

    permissions: {
      async request(scope: PermissionScope): Promise<'granted' | 'denied'> {
        return requestPermission(appId, scope);
      },

      has(scope: PermissionScope): boolean {
        return hasPermission(appId, scope);
      },
    },
  };

  return sdk;
}
