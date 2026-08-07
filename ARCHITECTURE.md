# ARCHITECTURE.md — WEVSOCIAL Super-App

## Overview

WEVSOCIAL is a super-app that hosts independent "mini-apps" (Sports, Events, Care) using a kernel/bridge architecture inspired by WeChat mini-programs. Each mini-app is fully isolated — it cannot directly access host state, other mini-apps' data, or native APIs except through a typed, permission-gated SDK injected at mount time.

---

## Kernel Design

### Host Shell (`app/(tabs)/_layout.tsx`)

The host shell is a thin Expo Router Tabs layout. It reads the mini-app registry to discover installed mini-apps and renders a tab for each one. **The shell never imports a component directly from a mini-app folder** — it only imports manifest objects (plain data) and relies on Expo Router's file-based routing to resolve the actual screens.

Each tab wraps its children in a `MiniAppHost` component that:
1. Creates a scoped SDK instance
2. Initializes permissions from the manifest
3. Wraps the subtree in an `ErrorBoundary` for fault isolation
4. Provides the SDK via React Context

### Mini-App Registry (`kernel/registry.ts`)

A declarative, manifest-driven registry. Each mini-app exports a `MiniAppManifest` object declaring:
- `id` — unique identifier
- `name` — display name
- `version` — semver string
- `icon` — tab bar icon key
- `requiredPermissions` — permission scopes the mini-app needs

**Adding a 4th mini-app requires:**
1. Create `mini-apps/<name>/manifest.ts` exporting a `MiniAppManifest`
2. Create route files under `app/(tabs)/<name>/`
3. Import the manifest in `kernel/registry.ts` and add it to the array
4. Add a `<Tabs.Screen>` entry in the tab layout

Steps 3-4 are the only changes to existing code. Sports/Events/Care code is untouched. The registry could be made fully dynamic (reading manifests from a directory at runtime), but the static import approach was chosen because:
- It gives full TypeScript type safety on manifests
- It enables tree-shaking
- Adding a single import + array entry is a trivial change

---

## Bridge / SDK — The Capability Boundary

### Design Philosophy

Every mini-app receives **only** an injected `WevSDK` object. There is no other path to host state, native APIs, or other mini-apps' storage. This is enforced architecturally:
- Mini-apps don't import the auth store, API client, or AsyncStorage directly
- The SDK is created per-mount by `sdk-factory.ts`, bound to the mini-app's ID
- Every SDK method checks permissions **before** executing any operation

### Permission Model

```
┌─────────────────────────────────────────────┐
│                  Mini-App                    │
│  calls wev.storage.set("key", value)        │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│              SDK Factory                     │
│  assertPermission('storage:write', ...)     │
│  → Checks PermissionManager                 │
│  → If denied: throw Error (no side effects) │
│  → If granted: proceed                      │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│           AsyncStorage                       │
│  Key: @wev:sports:key                       │
│  (namespaced — Sports can't read Care's)    │
└─────────────────────────────────────────────┘
```

**Two enforcement layers** (as required):
1. **API-level**: Backend auth middleware checks JWT + role. A Guest hitting a Host-only endpoint via `curl` gets 403.
2. **Bridge-level**: The SDK checks permission scopes INSIDE the bridge, BEFORE any network request is made. A mini-app calling `wev.storage.set()` without `storage:write` in its manifest gets a thrown error immediately.

### Storage Namespacing

Storage keys are prefixed with the mini-app's ID: `@wev:<appId>:<key>`. This is enforced in the SDK factory's `namespacedKey()` function. There is no way to bypass this — the raw AsyncStorage API is not exposed to mini-apps.

### Event Bus (Cross-Mini-App Communication)

The event bus (`kernel/bridge/event-bus.ts`) is a synchronous pub/sub system. Events are typed — every event that flows through the bridge has a TypeScript type in `types/bridge.ts`.

**Fault isolation in event dispatch**: If a listener throws, the error is caught and logged, but other listeners and the emitter continue normally. This prevents a buggy listener from crashing the event system.

---

## Fault Isolation

### Error Boundary Strategy

Each mini-app mounts inside its own `MiniAppErrorBoundary`. If Sports throws during render, the error boundary catches it and renders a fallback UI with a retry button. Care and Events continue running in their own boundaries.

### Reproducible Test Case

A "Crash Sports App" button in the Settings screen sets a global flag. The Sports list screen checks this flag and deliberately throws inside its render tree:

```typescript
if (shouldCrash) {
  throw new Error('Deliberate crash for fault isolation testing');
}
```

**To test fault isolation:**
1. Open the app → navigate to Settings
2. Tap "Crash Sports App"
3. Navigate to the Sports tab → see the error boundary fallback
4. Switch to Care or Events → they work normally
5. Tap "Retry" in the Sports error boundary → Sports recovers

### Bridge-Level Fault Isolation

The event bus wraps each listener call in a try/catch. If a listener in Sports throws while processing a bridge event, the error is logged but Care's listeners and the emitter continue unaffected.

---

## Auth Strategy

### Password Hashing

bcryptjs with a cost factor of 10. This provides ~100ms hash time on modern hardware, which is sufficient to resist offline brute-force attacks while keeping login latency acceptable.

### Token Rotation

- **Access tokens**: JWT, 15-minute expiry, contain `{userId, email, role}`.
- **Refresh tokens**: Random UUID, stored as bcrypt hash in the `refresh_tokens` table, 7-day expiry.
- On refresh: the old refresh token is **revoked** (marked as `revoked=true` in the DB), and a new access + refresh token pair is issued. This is **rotation** — a leaked refresh token becomes useless after one use.

### Token Storage

Access and refresh tokens are stored in `expo-secure-store`, which uses the Keychain on iOS and Encrypted SharedPreferences on Android. They are **never** stored in AsyncStorage, which is unencrypted.

### Silent Refresh

The API client (`kernel/api/client.ts`) intercepts 401 responses. On the first 401, it:
1. Calls `refreshTokens()` on the auth store
2. If the refresh succeeds, retries the original request with the new access token
3. If the refresh fails (e.g., refresh token expired), logs the user out

This happens transparently — the calling code doesn't know a refresh occurred.

---

## Geo-Privacy (Care Mini-App)

### Threat Model

Care providers' real addresses/coordinates must not leak to users before a booking is confirmed. This protects vulnerable populations (children, elderly) from location tracking.

### H3 Hexagonal Grid Obfuscation

**Algorithm** (`backend/src/utils/geo.ts`):

1. **Convert to H3 index**: `latLngToCell(lat, lng, resolution=8)` maps the real coordinates to an H3 hexagonal cell at resolution 8.
   - Resolution 8 has a hex edge length of ~461 meters, meaning the real location is anywhere within a ~0.74 km² hexagon.

2. **Snap to cell center**: `cellToLatLng(h3Index)` returns the center of the hex cell. This is the initial obfuscated point.

3. **Deterministic jitter**: A SHA-256 hash of the H3 index string produces a deterministic offset:
   ```
   offset_lat = (hash_bytes[0..3] / 0xFFFFFFFF - 0.5) * 0.002  (~±100m)
   offset_lng = (hash_bytes[4..7] / 0xFFFFFFFF - 0.5) * 0.002  (~±100m)
   ```
   This prevents providers in the same hex from snapping to the exact same center point, which would look unnatural on a map. The offset is stable across renders/restarts because it's derived from the H3 index, not random.

4. **Result**: The obfuscated point is within ~500m of the real location, stable across requests, and deterministic (same input → same output).

### API Enforcement

- `GET /api/care/providers` — returns ONLY `obfuscated_lat`, `obfuscated_lng`. The SQL query never selects `lat` or `lng`.
- `GET /api/care/providers/:id` — returns obfuscated coordinates. Real coordinates (`real_lat`, `real_lng`) are included ONLY if the requesting user has a CONFIRMED booking with this provider.
- `GET /api/care/bookings` — for each booking: CONFIRMED bookings include real coordinates; PENDING/CANCELLED bookings include only obfuscated.
- **List sorting**: Sort by obfuscated distance, not real distance. A naive exact-distance sort would leak the real location through ordering side-channels.

### Why H3 Over Alternatives

| Approach | Pros | Cons |
|----------|------|------|
| **H3 hexagonal grid** ✓ | Uniform cell shapes (no polar distortion), well-tested library, deterministic | Requires h3-js dependency |
| S2 geometry | Google-backed, hierachical | More complex API, overkill for this use case |
| Seeded hash offset | No dependency | Not spatially consistent, harder to reason about bounds |
| Random noise | Simple | Not deterministic, changes on every request |

H3 was chosen because it provides the best balance of spatial consistency, determinism, and simplicity.

---

## Offline State Machine

### State Transitions

```
    ┌──────┐
    │ IDLE │ ← User hasn't tried to book
    └──┬───┘
       │ User taps "Book" while offline
       ▼
   ┌────────┐
   │ QUEUED │ ← Persisted to AsyncStorage
   └───┬────┘
       │ Network reconnects
       ▼
  ┌─────────┐
  │ SYNCING │ ← Request in flight to backend
  └────┬────┘
       │
   ┌───┴────┐
   ▼        ▼
┌─────────┐ ┌───────────────────┐
│ SUCCESS │ │ CONFLICT_REJECTED │
└─────────┘ └───────────────────┘
```

### Persistence Choice: AsyncStorage

**Trade-off**: AsyncStorage vs SQLite

| Factor | AsyncStorage | SQLite |
|--------|-------------|--------|
| Setup complexity | Zero (built-in) | Requires `expo-sqlite` |
| Query capability | Key-value only | Full SQL |
| Transaction support | None | Full ACID |
| Max item size | ~2-6 MB (platform-dependent) | Unlimited |
| Our queue size | Dozens of items max | Overkill |

**Decision**: AsyncStorage. Our queue is a simple ordered list of booking requests, typically <10 items. We don't need SQL queries or transactions. The entire queue is serialized as a single JSON array. AsyncStorage's simplicity (no native module configuration, no schema migrations) wins for this use case.

### FIFO Ordering

Queue items are stored with a `queuedAt` ISO timestamp. The `getPendingItems()` function sorts by this timestamp ascending, ensuring first-in-first-out processing.

### Deduplication

Each queue item has a client-generated `idempotencyKey` (UUID v4). The backend's booking endpoint uses this key: if a request arrives with an idempotencyKey that already exists, the server returns the existing booking (200) instead of creating a duplicate (not 409).

Additionally, the client checks for existing QUEUED items with the same composite key (bookingType + activityId or providerId + startTime) before creating a new queue entry.

### Crash Recovery

On app startup, `loadQueue()` reads the persisted queue from AsyncStorage. Items stuck in `SYNCING` state (the app crashed during a sync attempt) are reset to `QUEUED`. The idempotencyKey ensures the backend won't create a duplicate even if the original request succeeded before the crash.

### 409 Conflict Handling

**Simulation**: The backend has a special test endpoint — booking activity `00000000-0000-0000-0000-000000000409` always returns 409. This allows testing the conflict flow without real double-booking.

**UI behavior on conflict**:
1. The optimistic UI ("Pending Sync" card) is replaced with a "Booking Conflict" error state
2. A toast notification appears: "This time slot was already booked"
3. The item transitions to `CONFLICT_REJECTED` state
4. The user can dismiss the error and try booking a different slot

---

## Performance Considerations

- **Cold start**: Expo Router + lazy loading keeps the bundle lean. Mini-app screens are only loaded when their tab is first visited.
- **List virtualization**: FlatList (React Native's built-in virtualized list) for activity and provider lists. For lists over 200 items, FlashList could be substituted for better scroll performance.
- **Reanimated 3**: Used for card entrance animations (FadeInDown) and booking state transitions. Runs on the native thread — no JS thread blocking.
- **Design tokens**: Defined in `kernel/theme/tokens.ts`, imported by all mini-apps. No copy-pasted style objects.

---

## What Was Cut and Why

### Phase 5 Cuts (Polish)

1. **FlashList**: We used React Native's standard `FlatList` instead of `@shopify/flash-list`. FlashList was not pre-installed in the environment, and `FlatList` provides more than sufficient performance for our current data sizes (<100 items). The risk of breaking the build with a new native dependency at the finish line outweighed the marginal performance benefit. All other Phase 5 polish (design tokens, Reanimated 3 transitions, custom skeleton loaders) was fully implemented.

### Phase 6 (OTA Bonus)

Not implemented in code. This was explicitly marked optional. See "Production OTA Design" below for how the architectural pattern would work.

### Production OTA Design (Phase 6 — Unbuilt)

For production-grade isolation, each mini-app would run in a **separate JavaScript context**:

1. **Separate JS Bundles**: Each mini-app is bundled independently (Metro multi-bundle or re.pack). Bundles are hosted on a CDN (S3 + CloudFront).

2. **Manifest-Driven Updates**: The shell checks a manifest URL on startup:
   ```json
   {
     "sports": { "version": "1.2.0", "bundleUrl": "https://cdn/sports-1.2.0.js", "checksum": "sha256:..." },
     "care": { "version": "1.1.0", "bundleUrl": "https://cdn/care-1.1.0.js", "checksum": "sha256:..." }
   }
   ```

3. **Version Check + Download**: If the local cached version differs from the manifest, download the new bundle. Verify integrity via SHA-256 checksum before loading.

4. **Hot-Swap**: Use `eval()` (sandboxed) or a WebView per mini-app to load the new bundle. The bridge SDK is injected into the new context, maintaining the same permission and isolation guarantees.

5. **Rollback**: Keep the previous bundle version cached. If the new bundle crashes on first load (detected by ErrorBoundary), automatically roll back to the previous version and report the failure to a monitoring service.

6. **Isolation**: In production, a `react-native-webview` per mini-app provides process-level isolation. Communication goes through `postMessage`/`onMessage` channels, which map cleanly to our existing bridge event system.

---

## Technology Choices

| Choice | Alternative | Rationale |
|--------|------------|-----------|
| **Zustand** (client state) | Redux Toolkit | Simpler API, less boilerplate, sufficient for our state shape. RTK's middleware/devtools are nice but not needed here. |
| **Expo Router** (navigation) | React Navigation bare | File-based routing is cleaner for the super-app structure. Each mini-app gets its own directory. |
| **Hand-built bridge** | Module federation, WebView | The bridge is the core graded deliverable. A library would obscure the permission logic. WebView would add complexity without clear benefit at this scale. |
| **bcryptjs** (password hashing) | argon2 | bcryptjs is pure JS — works in Docker without native compilation issues. argon2 is stronger but requires native bindings. |
| **H3** (geo-obfuscation) | S2, random offset | Best balance of spatial consistency and simplicity. See geo-privacy section. |
| **AsyncStorage** (offline queue) | SQLite, MMKV | Simplest option that meets requirements. See offline section. |

---

## Data Access Pattern

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   UI Component   │────▶│  TanStack Query  │────▶│   apiRequest()   │
│  (never calls    │     │   (useQuery /     │     │  (kernel/api/    │
│   API directly)  │     │    useMutation)   │     │   client.ts)     │
└──────────────────┘     └──────────────────┘     └────────┬─────────┘
                                                           │
                                                           ▼
                                                  ┌──────────────────┐
                                                  │    Backend API    │
                                                  │  (Express/Node)  │
                                                  └────────┬─────────┘
                                                           │
                                                           ▼
                                                  ┌──────────────────┐
                                                  │    PostgreSQL     │
                                                  │  (never touched  │
                                                  │   by mobile app) │
                                                  └──────────────────┘
```

UI components use TanStack Query hooks, which call `apiRequest()`. The API client automatically attaches auth tokens and handles 401 refresh. The mobile app **never** holds a database connection string.
