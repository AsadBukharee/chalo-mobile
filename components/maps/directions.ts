import { distanceBetween, type LatLng } from './geometry';
import { searchPlaces } from './places';
import { computeRoute, RoutesError } from './routes';
import type { RideWaypoints } from '../routeData';
import type { RawRouteLeg, RawRoutePayload, RouteLegKind } from './types';

/**
 * Road geometry for a ride, straight from the device.
 *
 * There is no backend hop for this: React Native's fetch is not subject to
 * CORS, so the app can talk to Google directly. The underlying call is the
 * Routes API (v2) — see routes.ts for why the legacy Directions API is not an
 * option on this project.
 */

/** Kept for callers that catch it by name; Routes failures surface as this. */
export class DirectionsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DirectionsError';
  }
}

const toLatLng = (point: { lat: number; lng: number }): LatLng => ({
  latitude: point.lat,
  longitude: point.lng,
});

/** Two points close enough that a road route between them is meaningless. */
const SAME_SPOT_METRES = 60;

async function leg(
  origin: LatLng,
  destination: LatLng,
  kind: RouteLegKind,
  signal?: AbortSignal,
): Promise<RawRouteLeg> {
  // A driver who has not pinned a separate pickup makes the first leg a point.
  // Asking Google to route from a place to itself costs a billed request and
  // returns nothing worth drawing, so answer it here.
  if (distanceBetween(origin, destination) < SAME_SPOT_METRES) {
    return {
      kind,
      polyline: '',
      distanceMeters: 0,
      durationSeconds: 0,
      durationInTrafficSeconds: null,
      summary: '',
    };
  }

  const route = await computeRoute(origin, destination, signal);

  // Routes gives a traffic-aware duration and a static one; the difference is
  // the delay, which is more honest than a separate "duration_in_traffic".
  return {
    kind,
    polyline: route.polyline,
    distanceMeters: route.distanceMeters,
    durationSeconds: route.staticDurationSeconds || route.durationSeconds,
    durationInTrafficSeconds: route.durationSeconds || null,
    summary: route.summary,
  };
}

function boundsOfPairs(points: LatLng[]) {
  const lats = points.map((point) => point.latitude);
  const lngs = points.map((point) => point.longitude);
  return {
    south: Math.min(...lats),
    west: Math.min(...lngs),
    north: Math.max(...lats),
    east: Math.max(...lngs),
  };
}

/**
 * Real road geometry for a ride, split into the three legs the UI colours
 * differently. Throws DirectionsError so the caller can keep whatever it was
 * already showing and explain why.
 */
export async function fetchDirectRoute(
  rideId: string,
  points: RideWaypoints,
  signal?: AbortSignal,
): Promise<RawRoutePayload> {
  const waypoints = {
    rider: toLatLng(points.rider),
    pickup: toLatLng(points.pickup),
    dropoff: toLatLng(points.dropoff),
    destination: toLatLng(points.destination),
  };

  let legs: RawRouteLeg[];
  try {
    legs = await Promise.all([
      leg(waypoints.rider, waypoints.pickup, 'pickup', signal),
      leg(waypoints.pickup, waypoints.dropoff, 'journey', signal),
      leg(waypoints.dropoff, waypoints.destination, 'arrival', signal),
    ]);
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error;
    const message =
      error instanceof RoutesError ? error.message : ((error as Error)?.message ?? 'Route lookup failed.');
    console.warn(`[maps] Routes: ${message}`);
    throw new DirectionsError(message);
  }

  // Legs that were skipped as zero-length carry no geometry; they stay in the
  // list so the three-segment UI keeps its shape, but contribute nothing.
  const durationSeconds = legs.reduce((sum, item) => sum + item.durationSeconds, 0);
  const durationInTraffic = legs.every((item) => item.durationInTrafficSeconds !== null)
    ? legs.reduce((sum, item) => sum + (item.durationInTrafficSeconds ?? 0), 0)
    : null;

  return {
    rideId,
    source: 'directions',
    polyline: legs[1]?.polyline ?? '',
    legs,
    waypoints: {
      rider: { lat: waypoints.rider.latitude, lng: waypoints.rider.longitude },
      pickup: { lat: waypoints.pickup.latitude, lng: waypoints.pickup.longitude },
      dropoff: { lat: waypoints.dropoff.latitude, lng: waypoints.dropoff.longitude },
      destination: {
        lat: waypoints.destination.latitude,
        lng: waypoints.destination.longitude,
      },
    },
    bounds: boundsOfPairs([
      waypoints.rider,
      waypoints.pickup,
      waypoints.dropoff,
      waypoints.destination,
    ]),
    distanceMeters: legs.reduce((sum, item) => sum + item.distanceMeters, 0),
    durationSeconds,
    durationInTrafficSeconds: durationInTraffic,
    trafficDelaySeconds: durationInTraffic ? Math.max(0, durationInTraffic - durationSeconds) : 0,
    fetchedAt: new Date().toISOString(),
  };
}

export type PlacePrediction = { id: string; primary: string; secondary: string };

/** Kept for the existing callers; the implementation is Places API (New). */
export async function fetchDirectPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<PlacePrediction[]> {
  try {
    return await searchPlaces(query, signal);
  } catch (error) {
    console.warn(`[maps] Places: ${(error as Error)?.message}`);
    return [];
  }
}

/** Straight-line distance, used to sanity-check geometry before drawing it. */
export function routeSpanMeters(points: LatLng[]) {
  if (points.length < 2) return 0;
  return distanceBetween(points[0]!, points[points.length - 1]!);
}
