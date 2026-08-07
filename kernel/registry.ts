/**
 * Mini-App Registry — runtime registry the shell reads to discover installed mini-apps.
 * 
 * ARCHITECTURE DECISION: Manifest-driven, declarative registry.
 * Adding a 4th mini-app requires ONLY:
 * 1. Creating a new manifest in the new mini-app's folder
 * 2. Importing and registering it here
 * Zero changes to Sports/Events/Care code, zero shell changes beyond this file.
 */

import { MiniAppManifest } from '../types/manifest';

// Import manifests from each mini-app
// NOTE: We import ONLY the manifest (a plain data object), not any components.
// Components are resolved lazily by the shell via React.lazy + the manifest id.
import { sportsManifest } from '../mini-apps/sports/manifest';
import { eventsManifest } from '../mini-apps/events/manifest';
import { careManifest } from '../mini-apps/care/manifest';

/**
 * Central registry of all installed mini-apps.
 * To add a new mini-app:
 * 1. Create mini-apps/<name>/manifest.ts exporting a MiniAppManifest
 * 2. Import it above
 * 3. Add it to this array
 */
const registry: ReadonlyArray<MiniAppManifest> = [
  sportsManifest,
  eventsManifest,
  careManifest,
];

/** Get all registered mini-app manifests */
export function getRegisteredApps(): ReadonlyArray<MiniAppManifest> {
  return registry;
}

/** Find a mini-app manifest by ID */
export function getAppManifest(appId: string): MiniAppManifest | undefined {
  return registry.find((m) => m.id === appId);
}
