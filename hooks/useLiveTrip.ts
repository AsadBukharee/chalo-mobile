import { useEffect, useMemo, useRef, useState } from 'react';
import {
  indexPath,
  lerpHeading,
  pointAtDistance,
  projectOntoPath,
  type LatLng,
  type PathIndex,
} from '@/components/maps/geometry';
import type { RideRoute } from '@/components/maps/useRideRoute';
import { useRideTracking, type TrackedVehicle } from './useRideTracking';

/**
 * Everything the live tracking screen needs, from one ride and its route.
 *
 * The raw feed is one GPS fix every six seconds. Shown as-is that is a marker
 * that teleports, sits in a field beside the motorway, and cuts the corner off
 * every bend. Three things fix it, and they are what this hook does:
 *
 *   1. Snap each fix onto the route. A phone is never exactly on the
 *      centreline, and "142 km travelled" is only meaningful as a distance
 *      along the road, not a distance from the origin as the crow flies.
 *   2. Move along the road between fixes, not straight through the countryside
 *      — interpolation happens in "metres along the route", so the car follows
 *      the bends it is actually driving.
 *   3. Stop moving when the data stops. A marker that keeps gliding on a fix
 *      from four minutes ago is lying about where the car is.
 */

/** How often the marker is redrawn while gliding between fixes. */
const FRAME_MS = 100;
/** The reporting interval the backend receives; what we interpolate across. */
const FIX_INTERVAL_MS = 6000;
/** Beyond this a fix is history, not a live position. */
const STALE_AFTER_SECONDS = 90;
/** Further than this from the route and the vehicle is not on it. */
const OFF_ROUTE_METERS = 500;
/** Below this the vehicle is stopped, and its speed says nothing about the ETA. */
const MOVING_MPS = 5;
/**
 * How far the projected position may slip backwards before we believe it.
 *
 * Consecutive fixes on a straight motorway can project a hundred metres behind
 * the last one purely from GPS noise, and a progress bar that twitches
 * backwards — or an ETA that counts *up* while you are moving — reads as a
 * broken app. Anything smaller than this is held at the furthest point
 * reached. Anything larger is a real reversal (a wrong turn, a U-turn, a
 * restarted trip) and is allowed through.
 */
const BACKWARD_TOLERANCE_M = 1000;

export type TripStatus =
  /** Ride is not being tracked (not started, or no API id). */
  | 'idle'
  /** Tracking, but the driver has never shared a position. */
  | 'waiting'
  /** A fresh position is coming through. */
  | 'live'
  /** We had a position, but it has gone quiet. */
  | 'stale'
  /** Reporting fine, but nowhere near this route. */
  | 'off-route';

export type LiveTrip = {
  status: TripStatus;
  /** Smoothed, snapped to the road. Null until the first fix arrives. */
  position: LatLng | null;
  /** Degrees clockwise from north, for rotating the vehicle marker. */
  heading: number;
  /** The untouched last fix, for anything that needs the truth rather than the picture. */
  raw: TrackedVehicle | null;
  ageSeconds: number | null;
  /** How far the last fix was from the route. */
  offRouteMeters: number | null;
  /** 0..1 along the whole route. */
  progress: number;
  travelledMeters: number;
  remainingMeters: number;
  /** Seconds to the destination at the current pace. Null when unknown. */
  etaSeconds: number | null;
  arrivalAt: Date | null;
  speedKph: number | null;
  error: string | null;
};

const IDLE: LiveTrip = {
  status: 'idle',
  position: null,
  heading: 0,
  raw: null,
  ageSeconds: null,
  offRouteMeters: null,
  progress: 0,
  travelledMeters: 0,
  remainingMeters: 0,
  etaSeconds: null,
  arrivalAt: null,
  speedKph: null,
  error: null,
};

export function useLiveTrip(
  route: RideRoute,
  rideApiId: number | null,
  enabled: boolean,
): LiveTrip {
  const { vehicle, waiting, error } = useRideTracking(rideApiId, enabled);

  // Indexing walks the whole polyline, so it happens once per route rather
  // than once per frame.
  const index: PathIndex | null = useMemo(
    () => (route.coordinates.length > 1 ? indexPath(route.coordinates) : null),
    [route.coordinates],
  );

  /** Metres along the route: where the marker is drawn, and where it is headed. */
  const from = useRef<number | null>(null);
  const to = useRef<number | null>(null);
  const startedAt = useRef(0);
  const heading = useRef(0);

  const [frame, setFrame] = useState(0);

  const projection = useMemo(() => {
    if (!index || !vehicle) return null;
    return projectOntoPath(index, { latitude: vehicle.latitude, longitude: vehicle.longitude });
  }, [index, vehicle]);

  // A new fix sets a new target; the animation below walks towards it.
  useEffect(() => {
    if (!projection) return;
    const previous = to.current;
    let next = projection.distanceAlong;
    if (previous !== null) {
      const backwards = previous - next;
      if (backwards > 0 && backwards < BACKWARD_TOLERANCE_M) next = previous;
    }
    from.current = previous ?? next;
    to.current = next;
    startedAt.current = Date.now();
  }, [projection]);

  // Reset when the route changes underneath us — the old distances mean
  // nothing on a different polyline.
  useEffect(() => {
    from.current = null;
    to.current = null;
  }, [index]);

  // A trip that is restarted, or a rider opening a different ride, must not
  // inherit the previous vehicle's progress.
  useEffect(() => {
    from.current = null;
    to.current = null;
    heading.current = 0;
  }, [rideApiId]);

  const stale = (vehicle?.ageSeconds ?? 0) > STALE_AFTER_SECONDS;
  const offRoute = (projection?.offRouteMeters ?? 0) > OFF_ROUTE_METERS;
  const gliding = !!vehicle && !stale && !offRoute && from.current !== to.current;

  useEffect(() => {
    if (!gliding) return;
    const timer = setInterval(() => setFrame((value) => value + 1), FRAME_MS);
    return () => clearInterval(timer);
  }, [gliding]);

  return useMemo(() => {
    if (!enabled || !rideApiId) return IDLE;
    if (!index) {
      return { ...IDLE, status: 'waiting', error: error ?? null };
    }

    if (!vehicle || to.current === null) {
      return {
        ...IDLE,
        status: waiting || !vehicle ? 'waiting' : 'live',
        error: error ?? null,
      };
    }

    // Where along the road to draw the car right now. While a fix is fresh the
    // marker glides from the previous one across the reporting interval; once
    // the feed goes quiet it stops dead at the last known point rather than
    // continuing to invent progress.
    const target = to.current;
    const previous = from.current ?? target;
    const elapsed = Date.now() - startedAt.current;
    const t = stale || offRoute ? 1 : Math.min(1, elapsed / FIX_INTERVAL_MS);
    const along = previous + (target - previous) * t;

    const at = pointAtDistance(index, along);
    if (at) {
      // The reported compass heading beats a derived one when the phone has a
      // sensor for it; the path bearing is the fallback and is usually better
      // than a heading computed from two noisy fixes.
      const wanted = vehicle.headingDegrees ?? at.heading;
      heading.current = lerpHeading(heading.current, wanted, 0.35);
    }

    const total = index.totalMeters;
    const travelled = Math.min(along, total);
    const remaining = Math.max(0, total - travelled);

    // Pace: the route's own traffic-aware average, overridden by the vehicle's
    // own speed only while it is actually moving. A car stopped at a barrier
    // reports 0 m/s, and dividing by that is an ETA of infinity.
    const routeSeconds = route.durationInTrafficSeconds ?? route.durationSeconds;
    const routeMps = routeSeconds > 0 && total > 0 ? total / routeSeconds : 0;
    const observed = vehicle.speedMps ?? 0;
    const mps = observed >= MOVING_MPS ? (observed + routeMps) / 2 : routeMps;

    const etaSeconds = mps > 0 ? Math.round(remaining / mps) : null;

    const status: TripStatus = offRoute ? 'off-route' : stale ? 'stale' : 'live';

    return {
      status,
      position: at?.position ?? null,
      heading: heading.current,
      raw: vehicle,
      ageSeconds: vehicle.ageSeconds,
      offRouteMeters: projection?.offRouteMeters ?? null,
      progress: total === 0 ? 0 : travelled / total,
      travelledMeters: travelled,
      remainingMeters: remaining,
      etaSeconds,
      arrivalAt: etaSeconds === null ? null : new Date(Date.now() + etaSeconds * 1000),
      speedKph: vehicle.speedMps === null ? null : Math.round(vehicle.speedMps * 3.6),
      error: error ?? null,
    };
    // `frame` is the animation clock: it is what re-runs this between fixes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    rideApiId,
    index,
    vehicle,
    waiting,
    error,
    projection,
    stale,
    offRoute,
    frame,
    route.durationSeconds,
    route.durationInTrafficSeconds,
  ]);
}
