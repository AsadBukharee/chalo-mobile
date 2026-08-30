import {
  CAN_CALL_GOOGLE_DIRECTLY,
  GOOGLE_MAPS_HOST,
  GOOGLE_MAPS_KEY,
  proxyUrl,
} from './config';
import { fetchDirectPlaces, fetchDirectRoute, type PlacePrediction } from './directions';
import type { RideWaypoints } from '../routeData';
import type { RawRoutePayload } from './types';

export type { PlacePrediction };
export type { RawRouteLeg, RawRoutePayload, RouteLegKind } from './types';

/**
 * One entry point for route geometry.
 *
 * Native talks to Google directly (no backend in the Android build). The web
 * build goes through the API server, because browsers can't call Google's
 * web-service APIs — they send no CORS headers.
 *
 * Underneath this is the Routes API and Places API (New); the legacy Directions
 * and Places endpoints cannot be enabled on this project at all.
 */
export async function fetchRoute(
  rideId: string,
  waypoints: RideWaypoints,
  signal?: AbortSignal,
) {
  if (CAN_CALL_GOOGLE_DIRECTLY) return fetchDirectRoute(rideId, waypoints, signal);

  const url = proxyUrl(`/maps/route?ride=${encodeURIComponent(rideId)}`);
  if (!url) return null;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Route request failed (${response.status})`);
  return (await response.json()) as RawRoutePayload;
}

export async function fetchPlaces(query: string, signal?: AbortSignal) {
  if (CAN_CALL_GOOGLE_DIRECTLY) {
    const predictions = await fetchDirectPlaces(query, signal);
    return { available: predictions.length > 0, predictions };
  }

  const url = proxyUrl(`/maps/places?q=${encodeURIComponent(query)}`);
  if (!url) return { available: false, predictions: [] as PlacePrediction[] };
  const response = await fetch(url, { signal });
  if (!response.ok) return { available: false, predictions: [] as PlacePrediction[] };
  return (await response.json()) as { available: boolean; predictions: PlacePrediction[] };
}

/**
 * A Static Maps image URL, built directly against Google.
 *
 * Image loads aren't CORS-restricted, so this one works identically on device
 * and in a browser without any backend.
 */
export function staticMapUrl(options: {
  center?: { lat: number; lng: number };
  zoom?: number;
  width?: number;
  height?: number;
  markers?: { lat: number; lng: number; color?: string }[];
  path?: { lat: number; lng: number }[];
}) {
  if (!GOOGLE_MAPS_KEY) return '';
  const params = new URLSearchParams({
    size: `${Math.min(Math.round(options.width ?? 640), 640)}x${Math.min(Math.round(options.height ?? 360), 640)}`,
    scale: '2',
    maptype: 'roadmap',
    key: GOOGLE_MAPS_KEY,
  });
  if (options.center) params.set('center', `${options.center.lat},${options.center.lng}`);
  if (options.zoom) params.set('zoom', String(options.zoom));
  for (const marker of options.markers ?? []) {
    params.append('markers', `color:${marker.color ?? 'orange'}|${marker.lat},${marker.lng}`);
  }
  if (options.path && options.path.length > 1) {
    // Thin the path out — the Static Maps URL has a practical length limit.
    const step = Math.max(1, Math.ceil(options.path.length / 60));
    const thinned = options.path.filter((_, index) => index % step === 0);
    params.append(
      'path',
      `color:0xF59E0BFF|weight:5|${thinned.map((point) => `${point.lat},${point.lng}`).join('|')}`,
    );
  }
  return `${GOOGLE_MAPS_HOST}/staticmap?${params.toString()}`;
}
