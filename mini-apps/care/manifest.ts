import { MiniAppManifest } from '../../types/manifest';

export const careManifest: MiniAppManifest = {
  id: 'care',
  name: 'Care',
  version: '1.0.0',
  icon: 'heart',
  requiredPermissions: [
    'auth:read',
    'storage:read',
    'storage:write',
    'nav:internal',
    'bridge:emit',
    'bridge:listen',
    'location:read',
  ],
  description: 'Book vetted childcare and eldercare services',
  accentColor: '#ec4899',
};
