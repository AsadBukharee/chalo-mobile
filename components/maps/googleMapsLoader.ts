import { GOOGLE_MAPS_KEY } from './config';

/**
 * Loads the Google Maps JavaScript SDK once per page (web build only).
 *
 * The key is baked in at build time by app.config.js, so there's no backend
 * round-trip before the map can start — the script tag goes straight out.
 *
 * We deliberately avoid `@types/google.maps`; the surface we touch is small and
 * typing it locally keeps the dependency tree simple.
 */

export type GoogleMaps = any;

declare global {
  interface Window {
    google?: { maps?: GoogleMaps };
    __chaloMapsCallback__?: () => void;
  }
}

export type MapsLoadResult =
  | { status: 'ready'; maps: GoogleMaps }
  | { status: 'unavailable'; reason: string };

let loadPromise: Promise<MapsLoadResult> | null = null;

const SCRIPT_ID = 'chalo-google-maps-sdk';

export function loadGoogleMaps(): Promise<MapsLoadResult> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve({ status: 'unavailable', reason: 'Maps only load in a browser.' });
  }
  if (window.google?.maps) {
    return Promise.resolve({ status: 'ready', maps: window.google.maps });
  }
  if (loadPromise) return loadPromise;

  if (!GOOGLE_MAPS_KEY) {
    return Promise.resolve({
      status: 'unavailable',
      reason: 'No Google Maps key is configured in app.config.js.',
    });
  }

  loadPromise = new Promise<MapsLoadResult>((resolve) => {
    const callbackName = '__chaloMapsCallback__';
    const timeout = setTimeout(() => {
      resolve({ status: 'unavailable', reason: 'Google Maps took too long to load.' });
    }, 12000);

    window[callbackName] = () => {
      clearTimeout(timeout);
      if (window.google?.maps) resolve({ status: 'ready', maps: window.google.maps });
      else resolve({ status: 'unavailable', reason: 'Google Maps loaded without a maps API.' });
    };

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_KEY)}` +
      `&libraries=geometry&loading=async&v=weekly&callback=${callbackName}`;
    script.onerror = () => {
      clearTimeout(timeout);
      // Allow a retry later — usually a blocked network or a key restriction.
      loadPromise = null;
      script.remove();
      resolve({
        status: 'unavailable',
        reason: 'Google Maps could not be reached. Check the key restrictions.',
      });
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
