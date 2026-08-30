import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * The Google Maps key, resolved once at startup.
 *
 * Priority:
 *   1. EXPO_PUBLIC_GOOGLE_MAPS_KEY  (eas.json build profile, or a local .env)
 *   2. extra.googleMapsApiKey       (baked in by app.config.js)
 *
 * `.env` is gitignored and EAS only uploads tracked files, so the app.config.js
 * default is what actually ships in the APK — the env var is the override.
 *
 * This key is embedded in the binary and is extractable from any APK. That is
 * unavoidable for a client-side Maps app; the protection is restriction in the
 * Google Cloud console, not secrecy. See README.md.
 */
export const GOOGLE_MAPS_KEY: string =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ||
  (Constants.expoConfig?.extra as { googleMapsApiKey?: string } | undefined)?.googleMapsApiKey ||
  '';

/**
 * Google's web-service APIs (Directions, Places, Static Maps) send no CORS
 * headers, so a browser can't call them directly — only native can. On web we
 * go through the API server proxy instead.
 */
export const CAN_CALL_GOOGLE_DIRECTLY = Platform.OS !== 'web';

/** Absolute base for the API server, used only by the web build. */
export function proxyUrl(path: string) {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  if (Platform.OS === 'web') return `/api${suffix}`;
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}/api${suffix}` : '';
}

export const GOOGLE_MAPS_HOST = 'https://maps.googleapis.com/maps/api';
