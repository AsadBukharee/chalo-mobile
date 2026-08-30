import { useEffect, useState } from 'react';

/**
 * A one-flag store that lets a map suspend the page it lives on.
 *
 * `Screen` renders a ScrollView. A fully interactive MapView inside a
 * ScrollView is a fight: the ScrollView claims vertical drags, so panning the
 * map scrolls the page instead — which is why the map preview used to be
 * gesture-dead on device. The map now grabs this lock the moment a finger
 * lands on it and releases it when the touch ends, so drags and pinches reach
 * the map and everything else on the screen still scrolls normally.
 *
 * A counter rather than a boolean: two maps on one screen (or a touch that
 * ends while another is still down) must not release each other's lock.
 */

let holders = 0;
const listeners = new Set<(locked: boolean) => void>();

function publish() {
  const locked = holders > 0;
  for (const listener of listeners) listener(locked);
}

export function acquireScrollLock() {
  holders += 1;
  if (holders === 1) publish();
}

export function releaseScrollLock() {
  if (holders === 0) return;
  holders -= 1;
  if (holders === 0) publish();
}

/** Belt and braces: a gesture that never reports its end can't wedge the page. */
export function resetScrollLock() {
  if (holders === 0) return;
  holders = 0;
  publish();
}

export function useScrollLocked() {
  const [locked, setLocked] = useState(holders > 0);
  useEffect(() => {
    listeners.add(setLocked);
    setLocked(holders > 0);
    return () => {
      listeners.delete(setLocked);
    };
  }, []);
  return locked;
}
