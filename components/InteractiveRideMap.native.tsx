import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import type {
  InteractiveRideMapHandle,
  InteractiveRideMapProps,
} from './InteractiveRideMap.types';
import { GOOGLE_MAPS_KEY } from './maps/config';
import { interpolateAlongPath, regionFromBounds } from './maps/geometry';
import { mapStyleFor } from './maps/mapStyles';

const EDGE_PADDING = { top: 70, right: 50, bottom: 90, left: 50 };
// Tighter than the whole-route padding: one leg should fill the frame.
const LEG_PADDING = { top: 110, right: 70, bottom: 190, left: 70 };
const MIN_ZOOM = 3;
const MAX_ZOOM = 19;

/**
 * Google's zoom level from a visible longitude span.
 *
 * The web-Mercator relation is  lngSpan = 360 · (widthPx / 256) / 2^zoom,
 * so the tile-width term matters: dropping it (as this file used to) reports
 * a zoom roughly log2(width/256) levels too low — about 0.6 on a 400 pt map.
 * That number was then fed straight back into `animateCamera({ zoom })`, so
 * tapping "+" could actually pull the camera *out*.
 */
function zoomFromSpan(longitudeDelta: number, widthPx: number) {
  const span = Math.max(longitudeDelta, 1e-6);
  const tiles = Math.max(widthPx, 1) / 256;
  return Math.log2((360 * tiles) / span);
}

function RouteMarker({
  color,
  haloColor,
  ringColor,
  size = 32,
}: {
  color: string;
  haloColor: string;
  ringColor: string;
  size?: number;
}) {
  return (
    <View style={[styles.marker, { width: size + 8, height: size + 8 }]}>
      <View
        style={[
          styles.markerHalo,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: haloColor,
            borderColor: ringColor,
          },
        ]}
      >
        <View style={[styles.markerDot, { backgroundColor: color, borderColor: ringColor }]} />
      </View>
    </View>
  );
}

/**
 * The device map.
 *
 * Camera is uncontrolled on purpose: feeding `region` back in on every change
 * fights the user's own gestures and makes the map snap back mid-drag. We set
 * an initial region and drive everything else imperatively through the ref.
 */
function InteractiveRideMapNative(
  {
    testID,
    route,
    colors,
    isDark,
    interactive = true,
    showTraffic = false,
    vehicleProgress = null,
    vehiclePosition = null,
    riderPosition = null,
    onPress,
    onReady,
    onZoomChange,
    onUserInteraction,
    onUnavailable,
    focusedLeg = null,
  }: InteractiveRideMapProps,
  ref: React.Ref<InteractiveRideMapHandle>,
) {
  const mapRef = useRef<MapView | null>(null);
  const baseZoom = useRef<number | null>(null);
  const zoom = useRef(7);
  const width = useRef(320);
  /** Set once the user pans or pinches, so auto-refit stops hijacking them. */
  const moved = useRef(false);
  const [ready, setReady] = useState(false);

  // Android draws an empty grey grid when the Maps SDK key is missing and
  // reports no error at all. Tell the caller so it can show the static
  // fallback rather than a blank rectangle.
  useEffect(() => {
    if (!GOOGLE_MAPS_KEY) {
      onUnavailable?.('No Google Maps key is configured (see app.config.js).');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    width.current = event.nativeEvent.layout.width || width.current;
  }, []);

  const fitRoute = useCallback(
    (animated = true) => {
      const map = mapRef.current;
      if (!map) return;
      moved.current = false;
      const coordinates = route.coordinates.length > 1 ? route.coordinates : null;
      if (coordinates) {
        map.fitToCoordinates(coordinates, { edgePadding: EDGE_PADDING, animated });
        return;
      }
      map.animateToRegion(regionFromBounds(route.bounds), animated ? 350 : 0);
    },
    [route],
  );

  useImperativeHandle(
    ref,
    () => ({
      fitRoute,
      /**
       * Step the camera by whole zoom levels.
       *
       * Read the live camera rather than trusting a locally tracked number:
       * the user's own pinches move the camera without going through here, and
       * an estimate derived from the region drifts. `getCamera()` is the truth.
       */
      zoomBy: (delta: number) => {
        const map = mapRef.current;
        if (!map) return;
        const step = async () => {
          let current = zoom.current;
          try {
            const camera = await map.getCamera();
            if (typeof camera?.zoom === 'number') current = camera.zoom;
          } catch {
            // getCamera can reject if the map went away mid-animation; the
            // tracked value is a good enough starting point.
          }
          const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current + delta));
          zoom.current = next;
          map.animateCamera({ zoom: next }, { duration: 260 });
          onZoomChange?.(next, baseZoom.current ?? next);
        };
        void step();
      },
      fitCoordinates: (coordinates, animated = true) => {
        const map = mapRef.current;
        if (!map || coordinates.length < 2) return;
        moved.current = true;
        map.fitToCoordinates(coordinates, { edgePadding: LEG_PADDING, animated });
      },
      focusOn: (coordinate, targetZoom) => {
        const map = mapRef.current;
        if (!map) return;
        moved.current = true;
        map.animateCamera(
          { center: coordinate, ...(targetZoom ? { zoom: targetZoom } : {}) },
          { duration: 420 },
        );
        if (targetZoom) zoom.current = targetZoom;
      },
    }),
    [fitRoute, onZoomChange],
  );

  // Refit when new geometry arrives (the Directions swap-in), but never yank
  // the camera away from someone who has panned it themselves — this map
  // refreshes every two minutes while a journey is live.
  useEffect(() => {
    if (ready && !moved.current) fitRoute(true);
  }, [route, ready, fitRoute]);

  // A real GPS fix from the driver always wins; the interpolated position is
  // only there so the journey screen shows something before tracking starts.
  const vehicle = vehiclePosition
    ? {
        position: { latitude: vehiclePosition.latitude, longitude: vehiclePosition.longitude },
        heading: vehiclePosition.heading ?? 0,
      }
    : vehicleProgress === null || vehicleProgress === undefined
      ? null
      : interpolateAlongPath(route.journeyCoordinates, vehicleProgress);

  const legColor: Record<string, { core: string; accent: string }> = {
    pickup: { core: colors.routePurple, accent: colors.routePurpleMarker },
    journey: { core: colors.routeOrange, accent: colors.routeOrangeMarker },
    arrival: { core: colors.routeGreen, accent: colors.routeGreenMarker },
  };

  if (!GOOGLE_MAPS_KEY) return null;

  return (
    <MapView
      ref={mapRef}
      accessibilityLabel="Interactive ride map"
      testID={testID}
      style={StyleSheet.absoluteFillObject}
      onLayout={onLayout}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      initialRegion={regionFromBounds(route.bounds)}
      customMapStyle={mapStyleFor(isDark)}
      mapType="standard"
      onPress={onPress}
      onMapReady={() => {
        setReady(true);
        fitRoute(false);
        onReady?.();
      }}
      onPanDrag={() => {
        moved.current = true;
        onUserInteraction?.();
      }}
      onRegionChange={(_region, details) => {
        if (details?.isGesture) {
          moved.current = true;
          onUserInteraction?.();
        }
      }}
      onRegionChangeComplete={(region) => {
        const next = zoomFromSpan(region.longitudeDelta, width.current);
        zoom.current = next;
        // The first settled camera is the whole route in frame — that is 100%.
        if (baseZoom.current === null) baseZoom.current = next;
        onZoomChange?.(next, baseZoom.current);
      }}
      showsCompass={false}
      showsScale={false}
      showsPointsOfInterest={false}
      showsBuildings={false}
      showsIndoors={false}
      showsTraffic={showTraffic}
      showsMyLocationButton={false}
      toolbarEnabled={false}
      moveOnMarkerPress={false}
      pitchEnabled={false}
      rotateEnabled={interactive}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      zoomTapEnabled={interactive}
      zoomControlEnabled={false}
      minZoomLevel={MIN_ZOOM}
      maxZoomLevel={MAX_ZOOM}
      loadingEnabled
      loadingBackgroundColor={isDark ? '#16222B' : '#F3EFE6'}
      loadingIndicatorColor={colors.primary}
    >
      {route.legs.map((leg) => {
        if (leg.coordinates.length < 2) return null;
        const tone = legColor[leg.kind] ?? legColor.journey!;
        const active = focusedLeg === leg.kind;
        return (
          <React.Fragment key={leg.kind}>
            {/* A soft casing for contrast against the map, then a thin core.
                Four stacked strokes at 14pt read as a highlighter smear; two
                thin ones read as a road.

                The short pickup and arrival hops are dashed, the way every map
                app draws a connecting leg. It is the cheapest way to make the
                three segments legible as three different things rather than
                one line that changes colour for no visible reason. */}
            <Polyline
              coordinates={leg.coordinates}
              strokeColor={isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.92)'}
              strokeWidth={active ? 8 : 6}
              lineCap="round"
              lineJoin="round"
              tappable={false}
              zIndex={1}
            />
            <Polyline
              coordinates={leg.coordinates}
              strokeColor={tone.core}
              strokeWidth={active ? 5 : 3.5}
              lineCap="round"
              lineJoin="round"
              lineDashPattern={leg.kind === 'journey' ? undefined : [10, 7]}
              tappable={false}
              zIndex={active ? 5 : 2}
            />
          </React.Fragment>
        );
      })}

      <Marker
        coordinate={riderPosition ?? route.waypoints.rider}
        anchor={{ x: 0.5, y: 0.5 }}
        title="You"
        tracksViewChanges={false}
        onPress={onPress}
      >
        <RouteMarker
          color={colors.routePurpleMarker}
          haloColor={colors.routePurpleSoft}
          ringColor={isDark ? '#111A21' : colors.white}
        />
      </Marker>
      <Marker
        coordinate={route.waypoints.pickup}
        anchor={{ x: 0.5, y: 0.5 }}
        title="Pickup"
        tracksViewChanges={false}
        onPress={onPress}
      >
        <RouteMarker
          color={colors.routeOrangeMarker}
          haloColor={colors.cream}
          ringColor={isDark ? '#111A21' : colors.white}
        />
      </Marker>
      <Marker
        coordinate={route.waypoints.dropoff}
        anchor={{ x: 0.5, y: 0.5 }}
        title="Drop-off"
        tracksViewChanges={false}
        onPress={onPress}
      >
        <RouteMarker
          color={colors.routeGreenMarker}
          haloColor={colors.routeGreenSoft}
          ringColor={isDark ? '#111A21' : colors.white}
        />
      </Marker>
      <Marker
        coordinate={route.waypoints.destination}
        anchor={{ x: 0.5, y: 0.5 }}
        title="Destination"
        tracksViewChanges={false}
        onPress={onPress}
      >
        <RouteMarker
          color={colors.routeGreenMarker}
          haloColor={colors.routeGreenSoft}
          ringColor={isDark ? '#111A21' : colors.white}
          size={36}
        />
      </Marker>

      {vehicle && (
        <Marker
          coordinate={vehicle.position}
          anchor={{ x: 0.5, y: 0.5 }}
          rotation={vehicle.heading}
          flat
          title="Your ride"
          tracksViewChanges={false}
          zIndex={40}
        >
          <View style={styles.vehicle}>
            <View style={[styles.vehiclePulse, { backgroundColor: colors.primary }]} />
            <View
              style={[
                styles.vehicleBody,
                { backgroundColor: colors.primary, borderColor: isDark ? '#111A21' : colors.white },
              ]}
            />
          </View>
        </Marker>
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  marker: { alignItems: 'center', justifyContent: 'center' },
  markerHalo: { alignItems: 'center', justifyContent: 'center', borderWidth: 2.5 },
  markerDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  vehicle: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  vehiclePulse: { position: 'absolute', width: 36, height: 36, borderRadius: 18, opacity: 0.22 },
  vehicleBody: { width: 16, height: 16, borderRadius: 5, borderWidth: 2.5 },
});

export default forwardRef(InteractiveRideMapNative);
