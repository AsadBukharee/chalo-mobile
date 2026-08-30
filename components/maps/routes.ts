import { GOOGLE_MAPS_KEY } from './config';
import type { LatLng } from './geometry';

/**
 * Google Routes API (v2) — the replacement for the legacy Directions API.
 *
 * Projects created from 2025 onward cannot enable the legacy web-service APIs
 * at all; calling `maps/api/directions/json` on one comes back REQUEST_DENIED
 * with "you're calling a legacy API". Routes is a different shape entirely:
 * POST with a JSON body, the key in a header rather than the query string, and
 * a mandatory field mask that decides both what you get back and what you are
 * billed for.
 *
 * Keeping the mask tight matters: asking for the full route object moves the
 * request into a more expensive SKU. We ask for the polyline, distance and
 * duration, and nothing else.
 */

const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

const FIELD_MASK = [
  'routes.polyline.encodedPolyline',
  'routes.distanceMeters',
  'routes.duration',
  'routes.staticDuration',
  'routes.description',
].join(',');

export class RoutesError extends Error {
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'RoutesError';
    this.status = status;
  }
}

export type ComputedRoute = {
  polyline: string;
  distanceMeters: number;
  /** Traffic-aware, because we ask for TRAFFIC_AWARE routing. */
  durationSeconds: number;
  /** The same leg with no traffic, so the delay is the difference. */
  staticDurationSeconds: number;
  summary: string;
};

/** "1234s" — Routes returns durations as protobuf duration strings. */
function seconds(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  const parsed = Number.parseFloat(value.replace(/s$/, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

const waypoint = (point: LatLng) => ({
  location: {
    latLng: { latitude: point.latitude, longitude: point.longitude },
  },
});

/** Turns Google's error body into something worth showing a person. */
function describe(status: number, body: any): RoutesError {
  const message: string = body?.error?.message ?? '';
  const reason: string = body?.error?.details?.[0]?.reason ?? '';

  if (status === 403 || /not been used|disabled/i.test(message)) {
    return new RoutesError(
      'The Routes API is not enabled for this project (or the key is restricted from it).',
      status,
    );
  }
  if (reason === 'API_KEY_HTTP_REFERRER_BLOCKED' || reason === 'API_KEY_ANDROID_APP_BLOCKED') {
    return new RoutesError('This app is not allowed to use that Maps key.', status);
  }
  if (status === 429) {
    return new RoutesError('Too many route requests — try again shortly.', status);
  }
  return new RoutesError(message || `Route request failed (${status}).`, status);
}

export async function computeRoute(
  origin: LatLng,
  destination: LatLng,
  signal?: AbortSignal,
  timeoutMs = 12000,
): Promise<ComputedRoute> {
  if (!GOOGLE_MAPS_KEY) {
    throw new RoutesError('No Google Maps key — check extra.googleMapsApiKey in app.config.js.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener?.('abort', onAbort);

  try {
    const response = await fetch(ROUTES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_KEY,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        origin: waypoint(origin),
        destination: waypoint(destination),
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        polylineQuality: 'HIGH_QUALITY',
        polylineEncoding: 'ENCODED_POLYLINE',
        computeAlternativeRoutes: false,
        languageCode: 'en',
        regionCode: 'PK',
        units: 'METRIC',
      }),
      signal: controller.signal,
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) throw describe(response.status, body);

    const route = body?.routes?.[0];
    if (!route?.polyline?.encodedPolyline) {
      // Routes answers 200 with an empty list when no road route exists.
      throw new RoutesError('No drivable route between those points.', 200);
    }

    const duration = seconds(route.duration);
    const staticDuration = seconds(route.staticDuration) || duration;

    return {
      polyline: route.polyline.encodedPolyline,
      distanceMeters: route.distanceMeters ?? 0,
      durationSeconds: duration,
      staticDurationSeconds: staticDuration,
      summary: typeof route.description === 'string' ? route.description : '',
    };
  } catch (error) {
    if (error instanceof RoutesError) throw error;
    if ((error as Error)?.name === 'AbortError' && !signal?.aborted) {
      throw new RoutesError('The route request timed out.');
    }
    if ((error as Error)?.name === 'AbortError') throw error;
    throw new RoutesError('Could not reach Google to build the route.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', onAbort);
  }
}
