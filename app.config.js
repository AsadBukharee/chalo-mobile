/**
 * Expo config.
 *
 * Static fields live in app.json; this file injects the Google keys into the
 * places that need them at build time:
 *
 *   - android.config.googleMaps.apiKey → the Maps SDK for Android. Without it
 *     react-native-maps renders an empty grey grid with no visible error.
 *   - ios.config.googleMapsApiKey → the Maps SDK for iOS.
 *   - extra.googleMapsApiKey → read by components/maps/config.ts for the
 *     Directions, Places and Static Maps calls the app makes directly.
 *   - android/ios googleServicesFile → Firebase (FCM + phone OTP).
 *
 * Override with GOOGLE_MAPS_API_KEY / EXPO_PUBLIC_GOOGLE_MAPS_KEY in the
 * environment (see eas.json). The literal below is the fallback so a plain
 * `eas build` works with no extra setup.
 *
 * The key belongs to the "chalo-intercity" Google Cloud project and is
 * restricted to the Maps APIs the app uses.
 *
 * SECURITY: this key ships inside the APK and can be extracted from it. That
 * is unavoidable for a client-side Maps app. The protection is restriction in
 * the Google Cloud console (Android package + SHA-1, iOS bundle id), not
 * secrecy — see docs/google-setup.md.
 */
const DEFAULT_MAPS_KEY = 'AIzaSyDQXH01Pi5zbX-4-ti7U4Kx0j8ROHtUB_Q';

const DEFAULT_API_BASE_URL = 'https://chalo-backend.vercel.app';

module.exports = ({ config }) => {
  const key =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    DEFAULT_MAPS_KEY;

  const androidKey = process.env.GOOGLE_MAPS_ANDROID_KEY || key;
  const iosKey = process.env.GOOGLE_MAPS_IOS_KEY || key;

  return {
    ...config,
    android: {
      ...config.android,
      // Firebase (FCM + phone auth) reads this at prebuild time.
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
      config: {
        ...config.android?.config,
        googleMaps: { apiKey: androidKey },
      },
    },
    ios: {
      ...config.ios,
      googleServicesFile: process.env.GOOGLE_SERVICES_PLIST || './GoogleService-Info.plist',
      config: {
        ...config.ios?.config,
        googleMapsApiKey: iosKey,
      },
    },
    extra: {
      ...config.extra,
      googleMapsApiKey: key,
      firebaseProjectId: 'chalo-intercity',
      // Base URL of the Django API on Vercel. Override per-environment with
      // EXPO_PUBLIC_API_BASE_URL (a local runserver, or a preview deployment).
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL,
    },
  };
};
