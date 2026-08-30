import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The device's own position, watched continuously.
 *
 * Foreground only, deliberately: background location needs a separate
 * permission, a visible notification and a Play Store declaration, and a rider
 * watching their ride arrive has the app open. A driver reporting their
 * position over a three-hour drive is the case that will eventually need
 * background, and that is a decision to make on purpose rather than by default.
 */

export type DevicePosition = {
  latitude: number;
  longitude: number;
  headingDegrees: number | null;
  speedMps: number | null;
  accuracyM: number | null;
  timestamp: number;
};

export type LocationPermission = 'unknown' | 'granted' | 'denied';

type Options = {
  /** Don't ask, don't watch. For screens where location is not wanted yet. */
  enabled?: boolean;
  /** Metres of movement before a new reading is delivered. */
  distanceIntervalM?: number;
  timeIntervalMs?: number;
};

export function useDeviceLocation(options: Options = {}) {
  const { enabled = true, distanceIntervalM = 10, timeIntervalMs = 4000 } = options;

  const [position, setPosition] = useState<DevicePosition | null>(null);
  const [permission, setPermission] = useState<LocationPermission>('unknown');
  const [error, setError] = useState<string | null>(null);
  const subscription = useRef<Location.LocationSubscription | null>(null);

  const toPosition = (reading: Location.LocationObject): DevicePosition => ({
    latitude: reading.coords.latitude,
    longitude: reading.coords.longitude,
    headingDegrees: reading.coords.heading ?? null,
    speedMps: reading.coords.speed ?? null,
    accuracyM: reading.coords.accuracy ?? null,
    timestamp: reading.timestamp,
  });

  const start = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermission('denied');
        return;
      }
      setPermission('granted');

      // One immediate fix so the map has something to draw straight away —
      // watchPosition can take several seconds for its first callback.
      try {
        const first = await Location.getLastKnownPositionAsync();
        if (first) setPosition(toPosition(first));
      } catch {
        // A missing last-known fix is normal on a cold device.
      }

      subscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: distanceIntervalM,
          timeInterval: timeIntervalMs,
        },
        (reading) => setPosition(toPosition(reading)),
      );
    } catch (caught) {
      setError((caught as Error)?.message ?? 'Could not read your location.');
    }
  }, [distanceIntervalM, timeIntervalMs]);

  useEffect(() => {
    if (!enabled) return;
    void start();
    return () => {
      subscription.current?.remove();
      subscription.current = null;
    };
  }, [enabled, start]);

  return {
    position,
    permission,
    error,
    /** Ask again after the user has been sent to settings. */
    retry: start,
  };
}
