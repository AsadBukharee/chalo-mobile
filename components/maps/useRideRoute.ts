import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchRoute, type RawRoutePayload, type RouteLegKind } from './api';
import {
  boundsOf,
  decodePolyline,
  padBounds,
  pathLength,
  type LatLng,
  type LatLngBounds,
} from './geometry';
import type { RideWaypoints } from '../routeData';

export type RouteLeg = {
  kind: RouteLegKind;
  coordinates: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
  durationInTrafficSeconds: number | null;
};

export type RideRoute = {
  rideId: string;
  source: 'directions' | 'fallback' | 'offline';
  legs: RouteLeg[];
  /** Every coordinate of the route, in travel order. */
  coordinates: LatLng[];
  /** The main city-to-city leg — what the live vehicle travels along. */
  journeyCoordinates: LatLng[];
  waypoints: { rider: LatLng; pickup: LatLng; dropoff: LatLng; destination: LatLng };
  bounds: LatLngBounds;
  distanceMeters: number;
  durationSeconds: number;
  durationInTrafficSeconds: number | null;
  trafficDelaySeconds: number;
};

const toLatLng = (point: { lat: number; lng: number }): LatLng => ({
  latitude: point.lat,
  longitude: point.lng,
});

/**
 * Straight-line geometry, drawn immediately so the map is never blank while
 * the road route is being fetched.
 *
 * Built from the ride's own waypoints — previously it came from a bundled
 * table keyed by ride id, which silently produced the same demo line for every
 * ride the server sent.
 */
function offlineRoute(rideId: string, waypoints: RideWaypoints): RideRoute {
  const points = [
    waypoints.rider,
    waypoints.pickup,
    waypoints.dropoff,
    waypoints.destination,
  ].map(toLatLng);
  const pickup = points.slice(0, 2);
  const journey = points.slice(1, 3);
  const arrival = points.slice(2);
  const makeLeg = (kind: RouteLegKind, coordinates: LatLng[]): RouteLeg => {
    const distanceMeters = pathLength(coordinates);
    return {
      kind,
      coordinates,
      distanceMeters,
      durationSeconds: Math.round(distanceMeters / (kind === 'journey' ? 19.4 : 6.9)),
      durationInTrafficSeconds: null,
    };
  };
  const legs = [
    makeLeg('pickup', pickup),
    makeLeg('journey', journey),
    makeLeg('arrival', arrival),
  ];
  return {
    rideId,
    source: 'offline',
    legs,
    coordinates: points,
    journeyCoordinates: journey,
    waypoints: {
      rider: points[0]!,
      pickup: points[1]!,
      dropoff: points[points.length - 2]!,
      destination: points[points.length - 1]!,
    },
    bounds: padBounds(boundsOf(points)),
    distanceMeters: legs.reduce((sum, leg) => sum + leg.distanceMeters, 0),
    durationSeconds: legs.reduce((sum, leg) => sum + leg.durationSeconds, 0),
    durationInTrafficSeconds: null,
    trafficDelaySeconds: 0,
  };
}

function toRideRoute(payload: RawRoutePayload): RideRoute {
  const legs: RouteLeg[] = payload.legs.map((leg) => ({
    kind: leg.kind,
    coordinates: decodePolyline(leg.polyline),
    distanceMeters: leg.distanceMeters,
    durationSeconds: leg.durationSeconds,
    durationInTrafficSeconds: leg.durationInTrafficSeconds,
  }));
  const coordinates = legs.flatMap((leg) => leg.coordinates);
  const journey = legs.find((leg) => leg.kind === 'journey')?.coordinates ?? coordinates;
  const usable = coordinates.length > 1 ? coordinates : [];
  return {
    rideId: payload.rideId,
    source: payload.source,
    legs,
    coordinates,
    journeyCoordinates: journey,
    waypoints: {
      rider: toLatLng(payload.waypoints.rider),
      pickup: toLatLng(payload.waypoints.pickup),
      dropoff: toLatLng(payload.waypoints.dropoff),
      destination: toLatLng(payload.waypoints.destination),
    },
    bounds: padBounds(usable.length ? boundsOf(usable) : payload.bounds),
    distanceMeters: payload.distanceMeters,
    durationSeconds: payload.durationSeconds,
    durationInTrafficSeconds: payload.durationInTrafficSeconds,
    trafficDelaySeconds: payload.trafficDelaySeconds,
  };
}

/**
 * A route with no geometry, for a ride we have no coordinates for.
 *
 * Returned rather than null so every consumer keeps its existing shape: the
 * map draws nothing, the readouts show zeroes, and the degraded banner
 * explains why. Making the hook nullable would push a null check into every
 * line of two large screens to say the same thing.
 */
function emptyRoute(rideId: string): RideRoute {
  const nowhere: LatLng = { latitude: 0, longitude: 0 };
  return {
    rideId,
    source: 'offline',
    legs: [],
    coordinates: [],
    journeyCoordinates: [],
    waypoints: { rider: nowhere, pickup: nowhere, dropoff: nowhere, destination: nowhere },
    bounds: { south: 0, west: 0, north: 0, east: 0 },
    distanceMeters: 0,
    durationSeconds: 0,
    durationInTrafficSeconds: null,
    trafficDelaySeconds: 0,
  };
}

const routeCache = new Map<string, RideRoute>();

/**
 * Fetches in flight, so two components asking for the same route share one.
 *
 * The live tracking screen needs the route for its distance maths and the map
 * needs it to draw. Both mount together with a cold cache, and each leg is a
 * billed Routes request — without this, every journey screen costs six calls
 * instead of three.
 */
const inFlight = new Map<string, Promise<RawRoutePayload | null>>();

function loadRoute(key: string, rideId: string, waypoints: RideWaypoints, signal?: AbortSignal) {
  const existing = inFlight.get(key);
  if (existing) return existing;
  // Deliberately not passing `signal`: one subscriber unmounting must not
  // cancel the request the other is still waiting on. Each caller drops its
  // own result instead.
  const promise = fetchRoute(rideId, waypoints).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

/**
 * A stable dependency for a waypoint object that is rebuilt on every render.
 *
 * Without this the load effect re-runs forever: `rideWaypoints(ride)` returns
 * a fresh object each time, so an object identity in the dependency list means
 * a new fetch on every render.
 */
function waypointsKey(waypoints: RideWaypoints | null): string {
  if (!waypoints) return 'none';
  const { rider, pickup, dropoff, destination } = waypoints;
  return [rider, pickup, dropoff, destination]
    .map((point) => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`)
    .join('|');
}

/**
 * Loads road-following route geometry for a ride.
 *
 * Renders immediately from the bundled straight-line data so the map is never
 * blank, then swaps in the real Directions geometry when it arrives. Refreshes
 * periodically so the traffic-aware ETA stays current.
 */
export function useRideRoute(
  rideId: string,
  /** Null when this ride has no coordinates at all — nothing to draw. */
  waypoints: RideWaypoints | null,
  options?: { refreshMs?: number },
) {
  const refreshMs = options?.refreshMs ?? 0;
  const [route, setRoute] = useState<RideRoute>(
    () =>
      routeCache.get(rideId) ??
      (waypoints ? offlineRoute(rideId, waypoints) : emptyRoute(rideId)),
  );
  const [status, setStatus] = useState<'loading' | 'ready' | 'degraded'>(
    routeCache.has(rideId) ? 'ready' : 'loading',
  );
  /** Google's own status string when a lookup fails, e.g. REQUEST_DENIED. */
  const [reason, setReason] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!waypoints) {
        setReason('This ride has no map coordinates yet.');
        setStatus('degraded');
        return;
      }
      try {
        const payload = await loadRoute(`${rideId}:${waypointsKey(waypoints)}`, rideId, waypoints);
        if (!mounted.current || signal?.aborted) return;
        if (!payload) {
          setReason('No route service reachable.');
          setStatus('degraded');
          return;
        }
        const next = toRideRoute(payload);
        if (next.coordinates.length < 2) {
          setReason('Route geometry was empty.');
          setStatus('degraded');
          return;
        }
        routeCache.set(rideId, next);
        setRoute(next);
        setReason(null);
        setStatus(next.source === 'directions' ? 'ready' : 'degraded');
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return;
        if (!mounted.current) return;
        // Show what Google actually said — a silent straight-line route is far
        // harder to debug than "REQUEST_DENIED: Directions API not enabled".
        setReason((error as Error)?.message ?? 'Route lookup failed.');
        setStatus('degraded');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rideId, waypointsKey(waypoints)],
  );

  useEffect(() => {
    const cached = routeCache.get(rideId);
    setRoute(cached ?? (waypoints ? offlineRoute(rideId, waypoints) : emptyRoute(rideId)));
    setReason(null);
    setStatus(cached ? 'ready' : 'loading');

    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [rideId, load]);

  useEffect(() => {
    if (!refreshMs) return;
    const timer = setInterval(() => {
      routeCache.delete(rideId);
      load();
    }, refreshMs);
    return () => clearInterval(timer);
  }, [refreshMs, rideId, load]);

  const refresh = useCallback(() => {
    routeCache.delete(rideId);
    setReason(null);
    setStatus('loading');
    load();
  }, [rideId, load]);

  return useMemo(
    () => ({ route, status, reason, refresh }),
    [route, status, reason, refresh],
  );
}
