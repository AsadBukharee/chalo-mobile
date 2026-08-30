import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { api, API_CONFIGURED } from '@/lib/api';

/**
 * Follows a ride's live vehicle position.
 *
 * Polling rather than a socket: one small GET every few seconds is enough for
 * a vehicle on a motorway, needs no connection to hold open across Pakistani
 * mobile coverage, and costs nothing on a serverless backend. A websocket is
 * the right answer at a scale this app is nowhere near.
 *
 * Stops while the app is backgrounded — a hidden screen polling every five
 * seconds is just battery and data.
 */

const POLL_MS = 6000;
/** Older than this and it is history, not a live position. */
const STALE_AFTER_SECONDS = 90;

export type TrackedVehicle = {
  latitude: number;
  longitude: number;
  headingDegrees: number | null;
  speedMps: number | null;
  ageSeconds: number;
  /** False when the last fix is too old to draw as "now". */
  isLive: boolean;
};

export function useRideTracking(rideId: number | null, enabled = true) {
  const [vehicle, setVehicle] = useState<TrackedVehicle | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled || !rideId || !API_CONFIGURED) {
      setVehicle(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const poll = async () => {
      try {
        const payload = await api.rideLocation(rideId, controller.signal);
        if (cancelled) return;
        const age = payload.age_seconds ?? 0;
        setVehicle({
          latitude: Number(payload.latitude),
          longitude: Number(payload.longitude),
          headingDegrees: payload.heading_degrees,
          speedMps: payload.speed_mps,
          ageSeconds: age,
          isLive: age <= STALE_AFTER_SECONDS,
        });
        setWaiting(false);
        setError(null);
      } catch (caught) {
        if (cancelled || (caught as Error)?.name === 'AbortError') return;
        // 404 is the normal "driver hasn't started sharing" case, not a fault.
        if ((caught as { status?: number })?.status === 404) {
          setVehicle(null);
          setWaiting(true);
          setError(null);
          return;
        }
        setError((caught as Error)?.message ?? 'Could not read the vehicle position.');
      }
    };

    const start = () => {
      void poll();
      timer.current = setInterval(poll, POLL_MS);
    };
    const stop = () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };

    start();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (!timer.current) start();
      } else {
        stop();
      }
    });

    return () => {
      cancelled = true;
      controller.abort();
      stop();
      subscription.remove();
    };
  }, [rideId, enabled]);

  return { vehicle, waiting, error };
}

/**
 * The driver side: pushes this device's position up for the ride.
 *
 * Fire-and-forget on purpose — a dropped report is replaced by the next one a
 * few seconds later, so retries would only queue stale positions behind fresh
 * ones.
 */
export function useRideReporter(
  rideId: number | null,
  position: {
    latitude: number;
    longitude: number;
    headingDegrees: number | null;
    speedMps: number | null;
    accuracyM: number | null;
  } | null,
  enabled: boolean,
) {
  const lastSent = useRef(0);

  useEffect(() => {
    if (!enabled || !rideId || !position || !API_CONFIGURED) return;

    // Throttle: watchPositionAsync can fire far more often than the backend
    // needs, and every report is a database row.
    const now = Date.now();
    if (now - lastSent.current < POLL_MS) return;
    lastSent.current = now;

    void api
      .reportRideLocation(rideId, {
        latitude: position.latitude,
        longitude: position.longitude,
        heading_degrees: position.headingDegrees,
        speed_mps: position.speedMps,
        accuracy_m: position.accuracyM,
      })
      .catch(() => {
        // Next tick will carry a newer position anyway.
      });
  }, [rideId, position, enabled]);
}
