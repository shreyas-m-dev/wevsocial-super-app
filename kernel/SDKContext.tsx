/**
 * SDKContext — React Context that provides the WevSDK to mini-app components.
 * 
 * Each mini-app gets its own SDKContext.Provider wrapping its component tree.
 * Mini-app components use the useWevSDK() hook to access the SDK.
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { WevSDK } from '../types/sdk';

const WevSDKContext = createContext<WevSDK | null>(null);

/** Hook for mini-app components to access their injected SDK */
export function useWevSDK(): WevSDK {
  const sdk = useContext(WevSDKContext);
  if (!sdk) {
    throw new Error(
      '[useWevSDK] WevSDK not available. This component must be rendered inside a MiniAppHost.'
    );
  }
  return sdk;
}

interface SDKProviderProps {
  sdk: WevSDK;
  children: ReactNode;
}

/** Provider component that injects the SDK into the mini-app's React tree */
export function SDKProvider({ sdk, children }: SDKProviderProps): React.JSX.Element {
  return (
    <WevSDKContext.Provider value={sdk}>
      {children}
    </WevSDKContext.Provider>
  );
}
