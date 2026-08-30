export type RouteLegKind = 'pickup' | 'journey' | 'arrival';

export type RawRouteLeg = {
  kind: RouteLegKind;
  polyline: string;
  distanceMeters: number;
  durationSeconds: number;
  durationInTrafficSeconds: number | null;
  summary: string;
};

export type RawRoutePayload = {
  rideId: string;
  source: 'directions' | 'fallback';
  polyline: string;
  legs: RawRouteLeg[];
  waypoints: {
    rider: { lat: number; lng: number };
    pickup: { lat: number; lng: number };
    dropoff: { lat: number; lng: number };
    destination: { lat: number; lng: number };
  };
  bounds: { south: number; west: number; north: number; east: number };
  distanceMeters: number;
  durationSeconds: number;
  durationInTrafficSeconds: number | null;
  trafficDelaySeconds: number;
  fetchedAt: string;
};
