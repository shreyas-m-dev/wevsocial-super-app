/**
 * Design Tokens — the SINGLE source of truth for visual design across ALL mini-apps.
 * 
 * ARCHITECTURE: Every mini-app imports tokens from here. No copy-pasting style objects.
 * Dark mode is supported via the theme system — toggling dark mode updates all mini-apps
 * simultaneously because they all reference these tokens.
 */

export const colors = {
  // Primary palette — vibrant indigo/purple
  primary: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
  },

  // Accent — warm amber
  accent: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
  },

  // Success / Error / Warning
  success: {
    light: '#34d399',
    main: '#10b981',
    dark: '#059669',
  },
  error: {
    light: '#f87171',
    main: '#ef4444',
    dark: '#dc2626',
  },
  warning: {
    light: '#fbbf24',
    main: '#f59e0b',
    dark: '#d97706',
  },

  // Neutral grays
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0a0a0a',
  },

  // Mini-app accent colors
  sports: '#3b82f6',   // Blue
  care: '#ec4899',     // Pink
  events: '#8b5cf6',   // Purple
} as const;

export const darkTheme = {
  background: '#0F0F23',
  surface: '#1a1a2e',
  surfaceElevated: '#242440',
  card: '#16213e',
  text: '#e0e0e0',
  textSecondary: '#a0a0b0',
  textMuted: '#707080',
  border: '#2a2a4a',
  primary: colors.primary[500],
  primaryLight: colors.primary[400],
  tabBar: '#0d0d1f',
  tabBarActive: colors.primary[400],
  tabBarInactive: '#505060',
  statusBar: '#0F0F23',
} as const;

export const lightTheme = {
  background: '#f8f9fa',
  surface: '#ffffff',
  surfaceElevated: '#ffffff',
  card: '#ffffff',
  text: '#1a1a2e',
  textSecondary: '#525252',
  textMuted: '#a3a3a3',
  border: '#e5e5e5',
  primary: colors.primary[600],
  primaryLight: colors.primary[500],
  tabBar: '#ffffff',
  tabBarActive: colors.primary[600],
  tabBarInactive: '#a3a3a3',
  statusBar: '#f8f9fa',
} as const;

export type Theme = typeof darkTheme;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const typography = {
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 22,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
  },
  button: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;
