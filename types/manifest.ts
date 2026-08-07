/**
 * Mini-App Manifest — the contract between the host shell and each mini-app.
 * Adding a new mini-app requires creating a new manifest; no changes to the shell.
 */

/** Permissions a mini-app can request from the host */
export type PermissionScope =
  | 'auth:read'       // Read user profile
  | 'auth:write'      // Modify user profile
  | 'storage:read'    // Read namespaced storage
  | 'storage:write'   // Write namespaced storage
  | 'location:read'   // Access location data
  | 'bridge:emit'     // Emit cross-app events
  | 'bridge:listen'   // Listen to cross-app events
  | 'nav:internal';   // Navigate within own stack

export interface MiniAppManifest {
  /** Unique identifier, e.g. 'sports', 'care', 'events' */
  id: string;
  /** Display name shown in the shell */
  name: string;
  /** Version string (semver) */
  version: string;
  /** Icon name for the tab bar */
  icon: string;
  /** Permissions this mini-app requires */
  requiredPermissions: ReadonlyArray<PermissionScope>;
  /** Optional description */
  description?: string;
  /** Color theme accent for this mini-app */
  accentColor?: string;
}
