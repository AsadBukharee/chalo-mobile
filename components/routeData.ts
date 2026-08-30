import type { MapRegion } from './InteractiveRideMap.types';

export type GeoPoint = { lat: number; lng: number };

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

export function getRoutePoints(rideId: string): GeoPoint[] {
  return routePoints[rideId] ?? routePoints['ride-ahmed'];
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