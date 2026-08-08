/**
 * MiniAppHost — the component that mounts a mini-app within the shell.
 * 
 * Responsibilities:
 * 1. Creates a scoped SDK instance for the mini-app
 * 2. Initializes permissions based on the manifest
 * 3. Wraps the mini-app in an ErrorBoundary for fault isolation
 * 4. Provides the SDK via React Context
 * 5. Cleans up permissions and event listeners on unmount
 * 
 * The shell renders one MiniAppHost per tab. The host doesn't import
 * the mini-app's components directly — it receives them as children
 * or via a render prop. The actual component resolution happens in
 * the Expo Router layout.
 */

import React, { useEffect, useMemo, ReactNode, useCallback, ErrorInfo } from 'react';
import { MiniAppManifest } from '../types/manifest';
import { ScopedUser } from '../types/sdk';
import { createSDK } from './bridge/sdk-factory';
import { removeAllListeners } from './bridge/event-bus';
import { initializePermissions, revokeAllPermissions } from './permissions';
import { MiniAppErrorBoundary } from './ErrorBoundary';
import { SDKProvider } from './SDKContext';

interface MiniAppHostProps {
  manifest: MiniAppManifest;
  children: ReactNode;
  /** Function to get the current authenticated user */
  getUser: () => Promise<ScopedUser | null>;
  /** Navigation callback scoped to this mini-app's stack */
  onNavigate: (target: string, params?: Record<string, string>) => void;
}

export function MiniAppHost({
  manifest,
  children,
  getUser,
  onNavigate,
}: MiniAppHostProps): React.JSX.Element {
  // CRITICAL: Initialize permissions synchronously before SDK creation.
  // If this were in useEffect (which runs after render), the SDK would be
  // created and children would call sdk.bridge.on() before permissions exist,
  // causing "Permission denied" errors on the first render.
  useMemo(() => {
    initializePermissions(manifest);
  }, [manifest]);

  // Cleanup permissions and listeners on unmount
  useEffect(() => {
    return () => {
      revokeAllPermissions(manifest.id);
      removeAllListeners(manifest.id);
    };
  }, [manifest]);

  // Create a stable SDK instance for this mini-app
  const sdk = useMemo(
    () => createSDK(manifest.id, getUser, onNavigate),
    [manifest.id, getUser, onNavigate]
  );

  const handleError = useCallback(
    (_appId: string, error: Error, _errorInfo: ErrorInfo) => {
      // In production, this would report to an error tracking service.
      console.error(`[MiniAppHost] Error in '${manifest.name}':`, error.message);
    },
    [manifest.name]
  );

  return (
    <MiniAppErrorBoundary
      appId={manifest.id}
      appName={manifest.name}
      onError={handleError}
    >
      <SDKProvider sdk={sdk}>
        {children}
      </SDKProvider>
    </MiniAppErrorBoundary>
  );
}
