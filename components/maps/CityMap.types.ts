export type CityMapProps = {
  testID?: string;
  latitude: number;
  longitude: number;
  label: string;
  isDark: boolean;
  markerColor: string;
  markerRing: string;
  /** Fires when the SDK can't be used, so the caller can show a fallback. */
  onUnavailable?: (reason: string) => void;
  onReady?: () => void;
};
