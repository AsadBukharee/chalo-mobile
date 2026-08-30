import type { MapRegion } from './InteractiveRideMap.types';
import type { Ride } from '@/data/mock';

export type GeoPoint = { lat: number; lng: number };

/**
 * The four points a ride's map is drawn from, in travel order.
 *
 * `rider` is where the trip starts for the passenger (the origin city, until
 * the device's own position is wired in), `pickup` and `dropoff` are the
 * driver's actual meeting points, and `destination` is the far city. The three
 * coloured segments on the journey card are the gaps between them.
 */
export type RideWaypoints = {
  rider: GeoPoint;
  pickup: GeoPoint;
  dropoff: GeoPoint;
  destination: GeoPoint;
};

export const routePoints: Record<string, GeoPoint[]> = {
  'ride-ahmed': [
    { lat: 31.4412, lng: 73.1279 },
    { lat: 31.4504, lng: 73.135 },
    { lat: 31.665, lng: 73.46 },
    { lat: 31.82, lng: 73.78 },
    { lat: 31.69, lng: 74.12 },
    { lat: 31.5204, lng: 74.3587 },
    { lat: 31.5278, lng: 74.365 },
  ],
  'ride-hamza': [
    { lat: 31.461, lng: 73.142 },
    { lat: 31.477, lng: 73.146 },
    { lat: 31.665, lng: 73.46 },
    { lat: 31.82, lng: 73.78 },
    { lat: 31.69, lng: 74.12 },
    { lat: 31.535, lng: 74.31 },
    { lat: 31.548, lng: 74.322 },
  ],
  'ride-usman': [
    { lat: 31.438, lng: 73.12 },
    { lat: 31.45, lng: 73.135 },
    { lat: 31.665, lng: 73.46 },
    { lat: 31.82, lng: 73.78 },
    { lat: 31.69, lng: 74.12 },
    { lat: 31.52, lng: 74.358 },
    { lat: 31.531, lng: 74.365 },
  ],
  'ride-isb': [
    { lat: 31.468, lng: 74.409 },
    { lat: 31.474, lng: 74.414 },
    { lat: 31.75, lng: 73.78 },
    { lat: 32.45, lng: 73.72 },
    { lat: 33.2, lng: 73.0 },
    { lat: 33.6844, lng: 73.0479 },
    { lat: 33.691, lng: 73.057 },
  ],
};

/**
 * Bundled geometry for one of the four sample rides.
 *
 * Returns an empty list for anything else. It used to fall back to
 * `routePoints['ride-ahmed']`, which meant every ride that came from the
 * server — all of which have ids like `ride-7` — silently drew the same
 * Faisalabad-to-Lahore line, and fed those same coordinates to the Routes API
 * so the road geometry was real but for entirely the wrong journey. A route
 * for a ride we have no geometry for is not a route.
 */
export function getRoutePoints(rideId: string): GeoPoint[] {
  return routePoints[rideId] ?? [];
}

/**
 * The waypoints for a ride, preferring the coordinates the server sent.
 *
 * Falls back to the bundled sample geometry, and then to null — at which point
 * the map says it has no route rather than drawing a confident wrong one.
 * A ride whose driver has not pinned a pickup still maps fine: the city centre
 * stands in, and the zero-length leg is skipped rather than drawn.
 */
export function rideWaypoints(ride: Ride): RideWaypoints | null {
  const origin = ride.originCoord;
  const destination = ride.destinationCoord;

  if (origin && destination) {
    return {
      rider: origin,
      pickup: ride.pickupCoord ?? origin,
      dropoff: ride.dropoffCoord ?? destination,
      destination,
    };
  }

  const bundled = getRoutePoints(ride.id);
  if (bundled.length >= 4) {
    return {
      rider: bundled[0]!,
      pickup: bundled[1]!,
      dropoff: bundled[bundled.length - 2]!,
      destination: bundled[bundled.length - 1]!,
    };
  }

  return null;
}

export function getRouteRegion(points: GeoPoint[]): MapRegion {
  const latitudes = points.map((point) => point.lat);
  const longitudes = points.map((point) => point.lng);
  const latitudeDelta = Math.max(0.5, (Math.max(...latitudes) - Math.min(...latitudes)) * 1.45);
  const longitudeDelta = Math.max(0.7, (Math.max(...longitudes) - Math.min(...longitudes)) * 1.35);
  return {
    latitude: (Math.max(...latitudes) + Math.min(...latitudes)) / 2,
    longitude: (Math.max(...longitudes) + Math.min(...longitudes)) / 2,
    latitudeDelta,
    longitudeDelta,
  };
}