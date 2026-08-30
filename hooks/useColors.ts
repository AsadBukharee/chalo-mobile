import { useColorScheme } from 'react-native';
import colors from '@/constants/colors';
import { useApp } from '@/context/AppContext';

/**
 * Resolves the active colour scheme from the user's in-app preference,
 * falling back to the device setting when they've chosen "system".
 */
export function useScheme(): 'light' | 'dark' {
  const scheme = useColorScheme();
  const { appearance } = useApp();
  return appearance === 'system' ? (scheme ?? 'light') : appearance;
}

/** Convenience for the map styles and other places that branch on theme. */
export function useIsDark() {
  return useScheme() === 'dark';
}

/**
 * Returns the design tokens for the current colour scheme, plus
 * scheme-independent values like `radius`.
 */
export function useColors() {
  const activeScheme = useScheme();
  const palette = colors[activeScheme];
  return { ...palette, radius: colors.radius };
}
