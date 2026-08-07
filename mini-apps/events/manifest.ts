import { MiniAppManifest } from '../../types/manifest';

export const eventsManifest: MiniAppManifest = {
  id: 'events',
  name: 'Events',
  version: '1.0.0',
  icon: 'calendar',
  requiredPermissions: [
    'auth:read',
    'nav:internal',
  ],
  description: 'Discover local meetups and classes',
  accentColor: '#8b5cf6',
};
