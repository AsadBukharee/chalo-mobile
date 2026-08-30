export type LatLng = { latitude: number; longitude: number };

export type LatLngBounds = { south: number; west: number; north: number; east: number };

/**
 * Decodes a Google encoded polyline into coordinates.
 * Ported from the reference algorithm so we don't need the geometry library
 * loaded before we can draw anything.
 */
export function decodePolyline(encoded: string): LatLng[] {
  if (!encoded) return [];
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

export function boundsOf(points: LatLng[]): LatLngBounds {
  const lats = points.map((point) => point.latitude);
  const lngs = points.map((point) => point.longitude);
  return {
    south: Math.min(...lats),
    west: Math.min(...lngs),
    north: Math.max(...lats),
    east: Math.max(...lngs),
  };
}

export function padBounds(bounds: LatLngBounds, ratio = 0.12): LatLngBounds {
  const latPad = Math.max((bounds.north - bounds.south) * ratio, 0.01);
  const lngPad = Math.max((bounds.east - bounds.west) * ratio, 0.01);
  return {
    south: bounds.south - latPad,
    west: bounds.west - lngPad,
    north: bounds.north + latPad,
    east: bounds.east + lngPad,
  };
}

export function regionFromBounds(bounds: LatLngBounds) {
  return {
    latitude: (bounds.north + bounds.south) / 2,
    longitude: (bounds.east + bounds.west) / 2,
    latitudeDelta: Math.max(bounds.north - bounds.south, 0.02),
    longitudeDelta: Math.max(bounds.east - bounds.west, 0.02),
  };
}

const EARTH_RADIUS = 6371000;
const toRad = (value: number) => (value * Math.PI) / 180;
const toDeg = (value: number) => (value * 180) / Math.PI;

export function distanceBetween(a: LatLng, b: LatLng) {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h));
}

export function pathLength(points: LatLng[]) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distanceBetween(points[index - 1]!, points[index]!);
  }
  return total;
}

export function bearingBetween(a: LatLng, b: LatLng) {
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Point at `fraction` (0..1) of the way along a path, plus the heading there.
 * Used to place the live vehicle marker on the real road geometry.
 */
export function interpolateAlongPath(points: LatLng[], fraction: number) {
  if (points.length === 0) return null;
  if (points.length === 1) return { position: points[0]!, heading: 0 };
  const clamped = Math.min(1, Math.max(0, fraction));
  const total = pathLength(points);
  if (total === 0) return { position: points[0]!, heading: 0 };

  let travelled = 0;
  const target = total * clamped;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]!;
    const end = points[index]!;
    const segment = distanceBetween(start, end);
    if (travelled + segment >= target) {
      const ratio = segment === 0 ? 0 : (target - travelled) / segment;
      return {
        position: {
          latitude: start.latitude + (end.latitude - start.latitude) * ratio,
          longitude: start.longitude + (end.longitude - start.longitude) * ratio,
        },
        heading: bearingBetween(start, end),
      };
    }
    travelled += segment;
  }
  const last = points[points.length - 1]!;
  const previous = points[points.length - 2]!;
  return { position: last, heading: bearingBetween(previous, last) };
}

export function formatDuration(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function formatDistance(meters: number | null | undefined) {
  if (!meters || meters <= 0) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}

export function formatClock(date: Date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

/* -------------------------------------------------------------------------- */
/*  Following a vehicle along a route                                         */
/* -------------------------------------------------------------------------- */

/**
 * Cumulative distance to each point of a path, so later lookups are a binary
 * search instead of a walk.
 *
 * Built once per route. Without it, moving the vehicle marker ten times a
 * second over a 1,500-point motorway polyline means ~15,000 haversines every
 * second, which is how a live map turns a phone into a hand warmer.
 */
export type PathIndex = {
  points: LatLng[];
  /** cumulative[i] is the distance in metres from points[0] to points[i]. */
  cumulative: number[];
  totalMeters: number;
};

export function indexPath(points: LatLng[]): PathIndex {
  const cumulative: number[] = new Array(points.length);
  let total = 0;
  for (let index = 0; index < points.length; index += 1) {
    if (index > 0) total += distanceBetween(points[index - 1]!, points[index]!);
    cumulative[index] = total;
  }
  return { points, cumulative, totalMeters: total };
}

/** The index of the last point at or before `meters`. */
function segmentAt(index: PathIndex, meters: number): number {
  const { cumulative } = index;
  let low = 0;
  let high = cumulative.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (cumulative[mid]! <= meters) low = mid;
    else high = mid - 1;
  }
  return low;
}

/** Position and heading a given distance along the path. */
export function pointAtDistance(
  index: PathIndex,
  meters: number,
): { position: LatLng; heading: number } | null {
  const { points, cumulative, totalMeters } = index;
  if (points.length === 0) return null;
  if (points.length === 1) return { position: points[0]!, heading: 0 };

  const target = Math.min(Math.max(meters, 0), totalMeters);
  const i = segmentAt(index, target);
  const start = points[i]!;
  const end = points[Math.min(i + 1, points.length - 1)]!;
  const spanStart = cumulative[i]!;
  const span = (cumulative[Math.min(i + 1, points.length - 1)] ?? spanStart) - spanStart;
  const ratio = span === 0 ? 0 : (target - spanStart) / span;

  return {
    position: {
      latitude: start.latitude + (end.latitude - start.latitude) * ratio,
      longitude: start.longitude + (end.longitude - start.longitude) * ratio,
    },
    heading: start === end ? 0 : bearingBetween(start, end),
  };
}

/**
 * Where a GPS fix falls on the route.
 *
 * A phone's position is never exactly on the polyline — it is a few metres off
 * the centreline at best, and a few hundred under a flyover. Projecting onto
 * the route is what turns a scatter of fixes into "142 km travelled, 43 to
 * go", and what stops the marker from drifting into the fields beside the
 * motorway.
 *
 * `offRouteMeters` is how far the fix was from the road. A large value is the
 * honest signal that the vehicle is not on this route at all — a detour, a
 * wrong turn, or a stale fix — and the caller can stop pretending otherwise.
 */
export type PathProjection = {
  /** Distance from the start of the path, in metres. */
  distanceAlong: number;
  /** How far the raw fix sat from the path. */
  offRouteMeters: number;
  /** The fix snapped onto the path. */
  position: LatLng;
  fraction: number;
};

export function projectOntoPath(index: PathIndex, point: LatLng): PathProjection | null {
  const { points, cumulative, totalMeters } = index;
  if (points.length === 0) return null;
  if (points.length === 1) {
    return {
      distanceAlong: 0,
      offRouteMeters: distanceBetween(points[0]!, point),
      position: points[0]!,
      fraction: 0,
    };
  }

  // Plane geometry in degrees, with longitude squashed by cos(latitude) so a
  // degree east is the same size as a degree north. Over a segment a few
  // hundred metres long the error against a proper geodesic projection is
  // centimetres, and it is an order of magnitude cheaper.
  const latScale = Math.cos(toRad(point.latitude)) || 1;
  let best: { index: number; ratio: number; distSq: number } | null = null;

  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const ax = (a.longitude - point.longitude) * latScale;
    const ay = a.latitude - point.latitude;
    const bx = (b.longitude - point.longitude) * latScale;
    const by = b.latitude - point.latitude;
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;

    const ratio = lenSq === 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / lenSq));
    const px = ax + dx * ratio;
    const py = ay + dy * ratio;
    const distSq = px * px + py * py;

    if (!best || distSq < best.distSq) best = { index: i, ratio, distSq };
  }

  if (!best) return null;

  const a = points[best.index - 1]!;
  const b = points[best.index]!;
  const position: LatLng = {
    latitude: a.latitude + (b.latitude - a.latitude) * best.ratio,
    longitude: a.longitude + (b.longitude - a.longitude) * best.ratio,
  };
  const distanceAlong =
    cumulative[best.index - 1]! + distanceBetween(a, position);

  return {
    distanceAlong,
    offRouteMeters: distanceBetween(point, position),
    position,
    fraction: totalMeters === 0 ? 0 : distanceAlong / totalMeters,
  };
}

/** Shortest signed turn from one heading to another, in degrees (-180..180]. */
export function headingDelta(from: number, to: number) {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/** Rotates `from` toward `to` the short way round, for smooth marker turns. */
export function lerpHeading(from: number, to: number, t: number) {
  return (from + headingDelta(from, to) * t + 360) % 360;
}
