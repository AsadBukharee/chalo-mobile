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
