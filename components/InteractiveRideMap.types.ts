import type { LatLng, LatLngBounds } from './maps/geometry';
import type { RideRoute } from './maps/useRideRoute';

export type MapCoordinate = LatLng;

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type InteractiveRideMapColors = {
  routePurple: string;
  routePurpleMarker: string;
  routePurpleSoft: string;
  routeOrange: string;
  routeOrangeMarker: string;
  routeGreen: string;
  routeGreenMarker: string;
  routeGreenSoft: string;
  primary: string;
  card: string;
  cream: string;
  charcoal: string;
  white: string;
};

/** Imperative camera control shared by the web and native implementations. */
export type InteractiveRideMapHandle = {
  fitRoute: (animated?: boolean) => void;
  zoomBy: (delta: number) => void;
  focusOn: (coordinate: MapCoordinate, zoom?: number) => void;
  /** Frame an arbitrary run of the route — one leg, say. */
  fitCoordinates: (coordinates: MapCoordinate[], animated?: boolean) => void;
};

export type InteractiveRideMapProps = {
  testID?: string;
  route: RideRoute;
  colors: InteractiveRideMapColors;
  isDark: boolean;
  /** Full pan/zoom/rotate. When false the map is a still, tappable preview. */
  interactive?: boolean;
  /** Requires two fingers (or ctrl+wheel) to zoom, so page scroll still works. */
  cooperativeGestures?: boolean;
  /** Google's live traffic overlay. */
  showTraffic?: boolean;
  /** Live vehicle position, 0..1 along the journey leg. Simulation fallback. */
  vehicleProgress?: number | null;
  /**
   * The vehicle's real reported position. Takes precedence over
   * `vehicleProgress` — a measured point beats an interpolated one.
   */
  vehiclePosition?: { latitude: number; longitude: number; heading?: number | null } | null;
  /** The rider's own device position, drawn as a distinct "you" marker. */
  riderPosition?: MapCoordinate | null;
  onPress?: () => void;
  onReady?: () => void;
  /** Current zoom plus the zoom at which the whole route fits, for a % readout. */
  onZoomChange?: (zoom: number, baseZoom: number) => void;
  /** Fired when the user pans/zooms, so the UI can offer "recenter". */
  onUserInteraction?: () => void;
  /** Fired when the map surface can't be used at all (no key, SDK blocked). */
  onUnavailable?: (reason: string) => void;
  /** Leg to emphasise; the others stay drawn but recede. */
  focusedLeg?: 'pickup' | 'journey' | 'arrival' | null;
};

export type { LatLngBounds, RideRoute };
