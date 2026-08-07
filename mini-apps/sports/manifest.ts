import { MiniAppManifest } from '../../types/manifest';

export const sportsManifest: MiniAppManifest = {
  id: 'sports',
  name: 'Sports',
  version: '1.0.0',
  icon: 'football',
  requiredPermissions: [
    'auth:read',
    'storage:read',
    'storage:write',
    'nav:internal',
    'bridge:emit',
    'bridge:listen',
  ],
  description: 'Discover and book sporting activities',
  accentColor: '#3b82f6',
};
