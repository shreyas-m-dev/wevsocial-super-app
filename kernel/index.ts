export { MiniAppHost } from './MiniAppHost';
export { MiniAppErrorBoundary } from './ErrorBoundary';
export { SDKProvider, useWevSDK } from './SDKContext';
export { createSDK } from './bridge/sdk-factory';
export { getRegisteredApps, getAppManifest } from './registry';
export { hasPermission, requestPermission } from './permissions';
