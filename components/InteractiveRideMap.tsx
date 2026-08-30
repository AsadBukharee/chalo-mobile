/**
 * Platform shim. Metro resolves `.web.tsx` / `.native.tsx` automatically, but
 * keeping this file means editors and TypeScript agree on a single entry point.
 */
export { default } from './InteractiveRideMap.web';
export type {
  InteractiveRideMapHandle,
  InteractiveRideMapProps,
} from './InteractiveRideMap.types';
