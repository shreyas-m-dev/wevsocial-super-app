# WEVSOCIAL — Super-App Technical Assessment

A super-app hosting independent mini-apps (Sports, Events, Care) with a kernel/bridge architecture, real credential auth, geo-privacy, and offline-first booking.

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose
- Expo CLI (`npm install -g expo-cli` or use `npx`)
- Android Emulator or iOS Simulator (or Expo Go on a physical device)

### 1. Start Infrastructure

```bash
# From the project root
docker compose up -d

# Wait for healthy postgres, then seed the database:
cd backend
npm install
npm run seed
cd ..
```

### 2. Start the Mobile App

```bash
# Install mobile dependencies
npm install

# Start Expo (Web is the verified working platform)
npx expo start --web
```

> [!WARNING]
> **Android / Expo Go Connection Issue**
> If you attempt to run the app on Android via Expo Go (by pressing `a`), you may encounter the exact error: `java.io.IOException: Failed to download remote update`.
> 
> We have exhaustively investigated and ruled out the standard causes:
> - **Network/Firewall**: Fails even over direct USB/ADB connection with tunnel/LAN bypass.
> - **Port Conflict**: Verified port 8081 is clear and Metro binds successfully.
> - **OTA Config**: Verified `app.json` has `updates.enabled: false` and no `runtimeVersion` or `eas.projectId`.
> - **Transitive Dependencies**: Verified `expo-updates` is completely absent from the codebase and `package.json`, including transitive dependencies via `npm ls expo-updates`.
> - **Manifest Resolution**: Verified `curl http://localhost:8081` successfully returns the Metro manifest on the host machine.
> 
> Despite these clean checks, Expo Go natively intercepts the connection and fails in a pre-JS state before the React application bundles. **Web is currently the verified working platform** to test the full React/UI functionality while this native Expo Go regression is diagnosed.

### Seed Accounts

| Email | Password | Role |
|-------|----------|------|
| alice@test.com | password123 | HOST |
| bob@test.com | password123 | GUEST |
| admin@test.com | password123 | ADMIN |

---

## Project Structure

```
├── app/                     # Expo Router screens
│   ├── _layout.tsx          # Root layout (providers, auth guard)
│   ├── (auth)/              # Login / Register screens
│   └── (tabs)/              # Tab-based host shell
│       ├── sports/          # Sports mini-app screens
│       ├── care/            # Care mini-app screens
│       ├── events/          # Events mini-app screens (stub)
│       └── settings.tsx     # Settings / Debug
├── kernel/                  # Host shell, registry, bridge/SDK
│   ├── bridge/              # Event bus + SDK factory
│   ├── api/                 # Typed API client
│   ├── hooks/               # Shared hooks (network, offline queue)
│   ├── offline/             # Offline queue + sync manager
│   ├── stores/              # Zustand stores (auth)
│   ├── theme/               # Design tokens + theme context
│   ├── registry.ts          # Mini-app manifest registry
│   ├── permissions.ts       # Permission manager
│   ├── MiniAppHost.tsx      # Mini-app host wrapper
│   ├── ErrorBoundary.tsx    # Per-mini-app fault isolation
│   └── SDKContext.tsx       # SDK React Context
├── mini-apps/               # Mini-app manifests
│   ├── sports/manifest.ts
│   ├── events/manifest.ts
│   └── care/manifest.ts
├── types/                   # Shared cross-boundary contracts
│   ├── manifest.ts          # Mini-app manifest shape
│   ├── bridge.ts            # Bridge event payloads
│   ├── api.ts               # API response DTOs
│   └── sdk.ts               # WevSDK interface
├── backend/                 # Express + TypeScript backend
│   ├── src/
│   │   ├── db/              # Pool, migrations, seed
│   │   ├── middleware/      # Auth + RBAC middleware
│   │   ├── routes/          # API routes
│   │   └── utils/           # Geo obfuscation, JWT helpers
│   └── Dockerfile
├── docker-compose.yml       # Postgres + Backend
├── ARCHITECTURE.md          # Architecture decisions + design docs
├── SDK.md                   # Mini-app developer documentation
└── README.md                # This file
```

---

## Testing Fault Isolation

To verify that a crashing mini-app doesn't take down the others:

1. Open the app and log in
2. Navigate to **Settings**
3. Tap **"Crash Sports App"**
4. Switch to the **Sports** tab → you'll see the error boundary fallback with a "Retry" button
5. Switch to **Care** or **Events** → they work normally, unaffected
6. Go back to **Sports** and tap **"Retry"** → Sports recovers

---

## Testing Cross-Mini-App Communication

1. Navigate to **Sports** and book an activity
2. Switch to the **Care** tab → a banner appears: "Need childcare during [activity name]?"
3. Tapping the banner opens the Care booking flow pre-filtered to the activity's time window

This communication flows through the bridge: `Sports → wev.bridge.emit('sports:session_booked') → Care listens via wev.bridge.on()`

---

## Testing Geo-Privacy

```bash
# Verify the API never leaks real coordinates:
curl http://localhost:3000/api/care/providers | python -m json.tool

# The response contains obfuscated_lat/obfuscated_lng only — no lat/lng fields.

# Now verify that confirmed bookings reveal real location:
# 1. Log in and create a care booking
# 2. Confirm it (as HOST or ADMIN)
# 3. Fetch the booking details — real_lat/real_lng will be present
```

---

## Testing Auth RBAC

```bash
# Guest trying to create an activity (HOST-only) → 403
curl -X POST http://localhost:3000/api/sports \
  -H "Authorization: Bearer <guest_token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","sportType":"soccer","startTime":"2024-01-01T10:00:00Z","endTime":"2024-01-01T12:00:00Z"}'

# Response: {"error":"FORBIDDEN","message":"Insufficient permissions."}
```

---

## Testing Offline Booking

1. Enable airplane mode on the device/emulator
2. Navigate to a sports activity and tap "Book"
3. The UI shows "Pending Sync" status
4. Disable airplane mode
5. The booking syncs automatically and the status updates to "Confirmed"

### 409 Conflict Testing

The backend simulates a double-booking conflict for activity ID `00000000-0000-0000-0000-000000000409`. Attempting to book this activity will trigger the conflict flow.

---

## Environment Variables

See `.env.example` for all required environment variables. The `docker-compose.yml` sets these automatically for local development.

---

## Key Architecture Decisions

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed documentation of:
- Kernel design and registry
- Bridge/SDK permission model
- Auth strategy with token rotation
- Geo-privacy H3 obfuscation math
- Offline state machine
- What was cut and why
- Production OTA design (unbuilt)

## Mini-App Developer Docs

See [SDK.md](./SDK.md) for the complete SDK reference. A third-party developer should be able to build a compliant mini-app from this document alone.
