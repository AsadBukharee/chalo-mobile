import type { MapRegion } from './InteractiveRideMap.types';

export type MapOffset = { x: number; y: number };
export type StoredMapCamera = {
  region?: MapRegion;
  scale?: number;
  offset?: MapOffset;
};

const cameraByRide = new Map<string, StoredMapCamera>();

export function getMapCamera(rideId: string): StoredMapCamera {
  return cameraByRide.get(rideId) ?? {};
}

export function updateMapCamera(rideId: string, camera: StoredMapCamera) {
  cameraByRide.set(rideId, { ...cameraByRide.get(rideId), ...camera });
}