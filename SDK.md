# WevSDK — Mini-App Developer Documentation

## Overview

The WevSDK is the **only** interface between your mini-app and the WEVSOCIAL host shell. Your mini-app receives an SDK instance at mount time — use it for authentication, storage, navigation, cross-app communication, and permission management.

**Your mini-app cannot and should not:**
- Import modules from other mini-apps
- Access AsyncStorage directly (use `wev.storage` instead)
- Make API calls outside the SDK/repository pattern
- Navigate outside your own stack

---

## Getting Started

### 1. Create Your Manifest

Every mini-app starts with a manifest file. Create `mini-apps/<your-app>/manifest.ts`:

```typescript
import { MiniAppManifest } from '../../types/manifest';

export const myAppManifest: MiniAppManifest = {
  id: 'my-app',           // Unique identifier
  name: 'My App',          // Display name in tab bar
  version: '1.0.0',        // Semver version string
  icon: 'star',            // Tab bar icon key
  requiredPermissions: [    // Permissions your app needs
    'auth:read',
    'storage:read',
    'storage:write',
    'nav:internal',
    'bridge:emit',
    'bridge:listen',
  ],
  description: 'A description of your mini-app',
  accentColor: '#10b981',  // Theme accent color (optional)
};
```

### 2. Register Your Manifest

Add your manifest to `kernel/registry.ts`:

```typescript
import { myAppManifest } from '../mini-apps/my-app/manifest';

const registry: ReadonlyArray<MiniAppManifest> = [
  sportsManifest,
  eventsManifest,
  careManifest,
  myAppManifest,  // ← Add here
];
```

### 3. Create Your Routes

Create route files under `app/(tabs)/<your-app>/`:

```
app/(tabs)/my-app/
  _layout.tsx    ← Stack layout wrapped in MiniAppHost
  index.tsx      ← Your main screen
  [id].tsx       ← Detail screens (optional)
```

### 4. Access the SDK

In any component within your mini-app's tree:

```typescript
import { useWevSDK } from '../../../kernel/SDKContext';

function MyComponent() {
  const wev = useWevSDK();
  // Now use wev.auth, wev.storage, wev.bridge, etc.
}
```

---

## API Reference

### `wev.auth`

#### `wev.auth.getUser(): Promise<ScopedUser | null>`

Returns the current authenticated user's profile, scoped to your mini-app's permissions.

**Required permission:** `auth:read`

```typescript
const user = await wev.auth.getUser();
if (user) {
  console.log(user.id, user.email, user.displayName, user.role);
}
```

**Return type:**
```typescript
interface ScopedUser {
  id: string;
  email: string;
  displayName: string | null;
  role: 'GUEST' | 'HOST' | 'ADMIN';
}
```

---

### `wev.storage`

Namespaced key-value storage. Your keys are automatically prefixed with your app ID — you cannot read or write another mini-app's data.

#### `wev.storage.get(key: string): Promise<unknown>`

**Required permission:** `storage:read`

```typescript
const savedFilters = await wev.storage.get('search_filters');
```

#### `wev.storage.set(key: string, val: unknown): Promise<void>`

**Required permission:** `storage:write`

```typescript
await wev.storage.set('search_filters', { distance: 10, sport: 'soccer' });
```

**Storage isolation example:**
```
Sports calls:  wev.storage.set('prefs', {...})  → stored as @wev:sports:prefs
Care calls:    wev.storage.set('prefs', {...})  → stored as @wev:care:prefs
// These are completely separate keys — no collision possible
```

---

### `wev.nav`

#### `wev.nav.navigate(target: string, params?: Record<string, string>): void`

Navigate within your mini-app's own stack. You **cannot** navigate to screens in other mini-apps directly — use bridge events for cross-app coordination.

**Required permission:** `nav:internal`

```typescript
// Navigate to a detail screen within your app
wev.nav.navigate('[id]', { id: 'activity-123' });
```

---

### `wev.bridge`

The bridge is the **only legal channel** for cross-mini-app communication.

#### `wev.bridge.emit(event: string, payload: object): void`

Emit a typed event that other mini-apps can listen to.

**Required permission:** `bridge:emit`

```typescript
// After booking a sports session, notify other apps
wev.bridge.emit('sports:session_booked', {
  activityId: '123',
  activityTitle: 'Saturday Soccer',
  sportType: 'soccer',
  startTime: '2024-03-15T10:00:00Z',
  endTime: '2024-03-15T12:00:00Z',
  locationName: 'Central Park',
});
```

#### `wev.bridge.on(event: string, handler: Function): () => void`

Listen for events from other mini-apps. Returns an unsubscribe function.

**Required permission:** `bridge:listen`

```typescript
// In Care mini-app: listen for sports bookings
useEffect(() => {
  const unsubscribe = wev.bridge.on('sports:session_booked', (payload) => {
    // payload is typed as SportsBookingEvent['payload']
    showBanner(`Need childcare during ${payload.activityTitle}?`);
  });

  return unsubscribe; // Clean up on unmount
}, []);
```

#### Available Event Types

| Event Type | Payload | Description |
|-----------|---------|-------------|
| `sports:session_booked` | `{ activityId, activityTitle, sportType, startTime, endTime, locationName }` | A sports session was booked |
| `care:needed_for_window` | `{ startTime, endTime, reason }` | Care is needed for a time window |
| `nav:cross_app` | `{ targetApp, targetRoute, params? }` | Request navigation to another app |

To add a new event type, add it to `types/bridge.ts`.

---

### `wev.permissions`

#### `wev.permissions.request(scope: PermissionScope): Promise<'granted' | 'denied'>`

Request a permission at runtime. Permissions declared in your manifest are auto-granted; undeclared permissions are denied.

```typescript
const result = await wev.permissions.request('location:read');
if (result === 'granted') {
  // Access location data
}
```

#### `wev.permissions.has(scope: PermissionScope): boolean`

Synchronously check if a permission is currently granted.

```typescript
if (wev.permissions.has('bridge:emit')) {
  wev.bridge.emit('my:event', { data: 'value' });
}
```

#### Permission Scopes

| Scope | Description |
|-------|-------------|
| `auth:read` | Read user profile |
| `auth:write` | Modify user profile |
| `storage:read` | Read from namespaced storage |
| `storage:write` | Write to namespaced storage |
| `location:read` | Access location data |
| `bridge:emit` | Emit cross-app events |
| `bridge:listen` | Listen to cross-app events |
| `nav:internal` | Navigate within own stack |

---

## Error Handling

### Bridge Permission Errors

If you call an SDK method without the required permission, it throws immediately:

```
Error: [WevSDK] Permission denied: App 'my-app' lacks 'storage:write' 
for operation 'storage.set'. Request this permission in your manifest's 
requiredPermissions array.
```

**Fix:** Add the missing scope to your manifest's `requiredPermissions`.

### Fault Isolation

Your mini-app runs inside an `ErrorBoundary`. If your code throws during render, the boundary catches it and shows a fallback UI with a retry button. **Other mini-apps are unaffected.**

Event listeners registered via `wev.bridge.on()` are also fault-isolated — if your handler throws, other handlers for the same event continue running.

---

## Best Practices

1. **Always check permissions** before optional SDK calls:
   ```typescript
   if (wev.permissions.has('bridge:emit')) {
     wev.bridge.emit('my:event', payload);
   }
   ```

2. **Clean up listeners** in `useEffect` return:
   ```typescript
   useEffect(() => {
     const unsubscribe = wev.bridge.on('event', handler);
     return unsubscribe;
   }, []);
   ```

3. **Never import from other mini-apps**. Use the bridge for coordination.

4. **Type your payloads**. Add new event types to `types/bridge.ts` for full type safety.

5. **Use the offline queue** for booking operations. It handles network failures, deduplication, and conflict resolution automatically.

---

## Example: Full Mini-App Screen

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useWevSDK } from '../../../kernel/SDKContext';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../../kernel/api/client';

interface MyItem {
  id: string;
  title: string;
}

export default function MyAppScreen() {
  const wev = useWevSDK();
  const [userName, setUserName] = useState<string>('');

  // Load user info via SDK
  useEffect(() => {
    wev.auth.getUser().then((user) => {
      if (user) setUserName(user.displayName ?? user.email);
    });
  }, [wev]);

  // Listen for cross-app events
  useEffect(() => {
    const unsub = wev.bridge.on('sports:session_booked', (payload) => {
      console.log('Sports session booked:', payload.activityTitle);
    });
    return unsub;
  }, [wev]);

  // Fetch data via repository pattern
  const { data, isLoading } = useQuery({
    queryKey: ['my-items'],
    queryFn: async (): Promise<MyItem[]> => {
      const { data } = await apiRequest<MyItem[]>('/my-items');
      return data;
    },
  });

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text>Welcome, {userName}</Text>
      {isLoading ? (
        <Text>Loading...</Text>
      ) : (
        data?.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => wev.nav.navigate('[id]', { id: item.id })}
          >
            <Text>{item.title}</Text>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}
```
