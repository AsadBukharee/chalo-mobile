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
import { getRoutePoints } from '../routeData';

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

/** Straight-line geometry from the bundled data, used before/without network. */
function offlineRoute(rideId: string): RideRoute {
  const points = getRoutePoints(rideId).map(toLatLng);
  const pickup = points.slice(0, 2);
  const journey = points.slice(1, -1);
  const arrival = points.slice(-2);
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

const routeCache = new Map<string, RideRoute>();

/**
 * Loads road-following route geometry for a ride.
 *
 * Renders immediately from the bundled straight-line data so the map is never
 * blank, then swaps in the real Directions geometry when it arrives. Refreshes
 * periodically so the traffic-aware ETA stays current.
 */
export function useRideRoute(rideId: string, options?: { refreshMs?: number }) {
  const refreshMs = options?.refreshMs ?? 0;
  const [route, setRoute] = useState<RideRoute>(() => routeCache.get(rideId) ?? offlineRoute(rideId));
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
      try {
        const payload = await fetchRoute(rideId, signal);
        if (!mounted.current) return;
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
    [rideId],
  );

  useEffect(() => {
    const cached = routeCache.get(rideId);
    setRoute(cached ?? offlineRoute(rideId));
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
