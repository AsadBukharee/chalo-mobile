import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type {
  InteractiveRideMapHandle,
  InteractiveRideMapProps,
} from './InteractiveRideMap.types';
import { loadGoogleMaps, type GoogleMaps } from './maps/googleMapsLoader';
import { interpolateAlongPath, type LatLng } from './maps/geometry';
import { mapStyleFor } from './maps/mapStyles';

type Overlay = { setMap: (map: unknown) => void };

const toLiteral = (point: LatLng) => ({ lat: point.latitude, lng: point.longitude });

/**
 * A real Google Maps JavaScript map: the user pans, pinches, scroll-zooms and
 * double-taps exactly as they would on maps.google.com, on top of live traffic.
 *
 * The route is drawn as a four-layer stack per leg — shadow, halo, coloured
 * core, and an animated dash train on the main leg — so it reads clearly at
 * every zoom level instead of disappearing into the basemap.
 */
function InteractiveRideMapWeb(
  {
    testID,
    route,
    colors,
    isDark,
    interactive = true,
    cooperativeGestures = false,
    showTraffic = false,
    vehicleProgress = null,
    onPress,
    onReady,
    onZoomChange,
    onUserInteraction,
    onUnavailable,
  }: InteractiveRideMapProps,
  ref: React.Ref<InteractiveRideMapHandle>,
) {
  const containerRef = useRef<unknown>(null);
  const mapsRef = useRef<GoogleMaps | null>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<Overlay[]>([]);
  const dashRef = useRef<any>(null);
  const trafficRef = useRef<any>(null);
  const vehicleRef = useRef<any>(null);
  const pulseRef = useRef<any>(null);
  const baseZoomRef = useRef<number>(7);
  const readyRef = useRef(false);
  const fittedRouteRef = useRef<unknown>(null);
  // The SDK loads asynchronously, so every effect that touches the map has to
  // wait for this rather than assuming mapRef is populated on first render.
  const [mapReady, setMapReady] = useState(false);
  const [failed, setFailed] = useState(false);

  /* ----------------------------- camera helpers ---------------------------- */

  const fitRoute = useCallback(
    (animated = true) => {
      const maps = mapsRef.current;
      const map = mapRef.current;
      if (!maps || !map) return;
      const bounds = new maps.LatLngBounds(
        { lat: route.bounds.south, lng: route.bounds.west },
        { lat: route.bounds.north, lng: route.bounds.east },
      );
      map.fitBounds(bounds, { top: 56, right: 40, bottom: 56, left: 40 });
      if (!animated) return;
    },
    [route.bounds],
  );

  useImperativeHandle(
    ref,
    () => ({
      fitRoute,
      zoomBy: (delta: number) => {
        const map = mapRef.current;
        if (!map) return;
        const next = Math.max(3, Math.min(20, (map.getZoom() ?? 7) + delta));
        map.setZoom(next);
      },
      focusOn: (coordinate, zoom) => {
        const map = mapRef.current;
        if (!map) return;
        map.panTo(toLiteral(coordinate));
        if (zoom) map.setZoom(zoom);
      },
      /** Frame one leg: extend an empty bounds over its points and fit that. */
      fitCoordinates: (coordinates) => {
        const maps = mapsRef.current;
        const map = mapRef.current;
        if (!maps || !map || coordinates.length < 2) return;
        const bounds = new maps.LatLngBounds();
        for (const point of coordinates) bounds.extend(toLiteral(point));
        map.fitBounds(bounds, { top: 90, right: 60, bottom: 150, left: 60 });
      },
    }),
    [fitRoute],
  );

  /* ------------------------------- bootstrap ------------------------------- */

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps().then((result) => {
      if (cancelled) return;
      if (result.status !== 'ready') {
        setFailed(true);
        onUnavailable?.(result.reason);
        return;
      }
      // react-native-web forwards refs to the underlying DOM node.
      const node = containerRef.current as unknown as HTMLElement | null;
      if (!node) return;

      const maps = result.maps;
      mapsRef.current = maps;

      const map = new maps.Map(node, {
        center: {
          lat: (route.bounds.north + route.bounds.south) / 2,
          lng: (route.bounds.east + route.bounds.west) / 2,
        },
        zoom: 7,
        disableDefaultUI: true,
        clickableIcons: false,
        keyboardShortcuts: interactive,
        gestureHandling: interactive ? (cooperativeGestures ? 'cooperative' : 'greedy') : 'none',
        scrollwheel: interactive,
        draggable: interactive,
        zoomControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        mapTypeControl: false,
        rotateControl: false,
        maxZoom: 18,
        minZoom: 4,
        backgroundColor: isDark ? '#16222B' : '#F3EFE6',
        styles: mapStyleFor(isDark),
      });
      mapRef.current = map;

      maps.event.addListenerOnce(map, 'idle', () => {
        readyRef.current = true;
        baseZoomRef.current = map.getZoom() ?? 7;
        setMapReady(true);
        onZoomChange?.(baseZoomRef.current, baseZoomRef.current);
        onReady?.();
      });
      map.addListener('zoom_changed', () => {
        onZoomChange?.(map.getZoom() ?? 7, baseZoomRef.current);
      });
      map.addListener('dragstart', () => onUserInteraction?.());
      if (onPress) map.addListener('click', () => onPress());

      fitRoute(false);

      // Keep the fit sensible when the map is resized (preview → full screen).
      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => {
          if (!readyRef.current) fitRoute(false);
        });
        observer.observe(node);
        (map as any).__chaloResizeObserver = observer;
      }
    });

    return () => {
      cancelled = true;
    };
    // Rebuilding the map instance on every prop tick would be wasteful; the
    // effects below keep it in sync instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      const map = mapRef.current as any;
      map?.__chaloResizeObserver?.disconnect?.();
      overlaysRef.current.forEach((overlay) => overlay.setMap(null));
      overlaysRef.current = [];
      trafficRef.current?.setMap(null);
      vehicleRef.current?.setMap(null);
      pulseRef.current?.setMap(null);
    },
    [],
  );

  /* -------------------------------- theming -------------------------------- */

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setOptions({
      styles: mapStyleFor(isDark),
      backgroundColor: isDark ? '#16222B' : '#F3EFE6',
    });
  }, [isDark, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setOptions({
      gestureHandling: interactive ? (cooperativeGestures ? 'cooperative' : 'greedy') : 'none',
      scrollwheel: interactive,
      draggable: interactive,
      keyboardShortcuts: interactive,
    });
  }, [interactive, cooperativeGestures, mapReady]);

  /* ------------------------------ traffic layer ---------------------------- */

  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;
    if (showTraffic) {
      if (!trafficRef.current) trafficRef.current = new maps.TrafficLayer();
      trafficRef.current.setMap(map);
    } else {
      trafficRef.current?.setMap(null);
    }
  }, [showTraffic, mapReady]);

  /* --------------------------- the route rendering -------------------------- */

  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;

    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    overlaysRef.current = [];

    const legColor: Record<string, string> = {
      pickup: colors.routePurple,
      journey: colors.routeOrange,
      arrival: colors.routeGreen,
    };
    const legAccent: Record<string, string> = {
      pickup: colors.routePurpleMarker,
      journey: colors.routeOrangeMarker,
      arrival: colors.routeGreenMarker,
    };

    const add = (overlay: Overlay) => {
      overlay.setMap(map);
      overlaysRef.current.push(overlay);
      return overlay;
    };

    route.legs.forEach((leg) => {
      if (leg.coordinates.length < 2) return;
      const path = leg.coordinates.map(toLiteral);
      const core = legColor[leg.kind] ?? colors.routeOrange;
      const accent = legAccent[leg.kind] ?? colors.routeOrangeMarker;

      // Shadow beneath everything, so the line lifts off the basemap.
      add(
        new maps.Polyline({
          path,
          strokeColor: colors.charcoal,
          strokeOpacity: isDark ? 0.55 : 0.22,
          strokeWeight: 14,
          zIndex: 1,
          clickable: false,
        }),
      );
      // Halo keeps the colour legible over dark roads and water.
      add(
        new maps.Polyline({
          path,
          strokeColor: isDark ? '#0B141A' : colors.white,
          strokeOpacity: 0.95,
          strokeWeight: 10,
          zIndex: 2,
          clickable: false,
        }),
      );
      add(
        new maps.Polyline({
          path,
          strokeColor: core,
          strokeOpacity: 1,
          strokeWeight: 6.5,
          zIndex: 3,
          clickable: false,
        }),
      );
      // A thin accent down the middle gives the line a gradient-ish depth.
      add(
        new maps.Polyline({
          path,
          strokeColor: accent,
          strokeOpacity: 0.5,
          strokeWeight: 2,
          zIndex: 4,
          clickable: false,
        }),
      );
    });

    /* --------------------------- animated dash train -------------------------- */

    const journey = route.legs.find((leg) => leg.kind === 'journey');
    if (journey && journey.coordinates.length > 1) {
      const dash = add(
        new maps.Polyline({
          path: journey.coordinates.map(toLiteral),
          strokeOpacity: 0,
          zIndex: 5,
          clickable: false,
          icons: [
            {
              icon: {
                path: 'M 0,-1.1 0,1.1',
                strokeColor: isDark ? '#111A21' : '#FFFFFF',
                strokeOpacity: 0.95,
                strokeWeight: 3.5,
                scale: 3,
              },
              offset: '0%',
              repeat: '26px',
            },
          ],
        }),
      );
      dashRef.current = dash;
    } else {
      dashRef.current = null;
    }

    /* -------------------------------- markers -------------------------------- */

    const circle = (fill: string, stroke: string, scale: number, zIndex: number) => ({
      path: maps.SymbolPath.CIRCLE,
      scale,
      fillColor: fill,
      fillOpacity: 1,
      strokeColor: stroke,
      strokeWeight: 3,
      zIndex,
    });

    const marker = (
      position: LatLng,
      fill: string,
      halo: string,
      title: string,
      zIndex: number,
    ) => {
      add(
        new maps.Marker({
          position: toLiteral(position),
          icon: { ...circle(halo, halo, 13, zIndex), fillOpacity: 0.45, strokeWeight: 0 },
          clickable: false,
          zIndex,
        }),
      );
      add(
        new maps.Marker({
          position: toLiteral(position),
          icon: circle(fill, isDark ? '#111A21' : '#FFFFFF', 7.5, zIndex + 1),
          title,
          clickable: false,
          zIndex: zIndex + 1,
        }),
      );
    };

    marker(route.waypoints.rider, colors.routePurpleMarker, colors.routePurple, 'You', 10);
    marker(route.waypoints.pickup, colors.routeOrangeMarker, colors.routeOrange, 'Pickup', 12);
    marker(route.waypoints.dropoff, colors.routeGreenMarker, colors.routeGreen, 'Drop-off', 14);
    marker(
      route.waypoints.destination,
      colors.routeGreenMarker,
      colors.routeGreen,
      'Destination',
      16,
    );

    // Only recentre when the geometry itself changed — a theme flip or a colour
    // change must not yank the camera away from where the user put it.
    if (fittedRouteRef.current !== route) {
      fittedRouteRef.current = route;
      fitRoute(false);
    }
  }, [route, colors, isDark, fitRoute, mapReady]);

  /* ---------------------------- dash animation ---------------------------- */

  useEffect(() => {
    if (!dashRef.current) return;
    let offset = 0;
    const timer = setInterval(() => {
      const dash = dashRef.current;
      if (!dash) return;
      offset = (offset + 1) % 100;
      const icons = dash.get('icons');
      if (!icons?.[0]) return;
      icons[0].offset = `${offset}%`;
      dash.set('icons', icons);
    }, 60);
    return () => clearInterval(timer);
  }, [route, mapReady]);

  /* ---------------------------- live vehicle ------------------------------ */

  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;

    if (vehicleProgress === null || vehicleProgress === undefined) {
      vehicleRef.current?.setMap(null);
      pulseRef.current?.setMap(null);
      vehicleRef.current = null;
      pulseRef.current = null;
      return;
    }

    const spot = interpolateAlongPath(route.journeyCoordinates, vehicleProgress);
    if (!spot) return;

    if (!pulseRef.current) {
      pulseRef.current = new maps.Marker({
        map,
        clickable: false,
        zIndex: 40,
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 16,
          fillColor: colors.primary,
          fillOpacity: 0.22,
          strokeWeight: 0,
        },
      });
    }
    if (!vehicleRef.current) {
      vehicleRef.current = new maps.Marker({
        map,
        clickable: false,
        zIndex: 41,
        title: 'Your ride',
      });
    }

    pulseRef.current.setPosition(toLiteral(spot.position));
    vehicleRef.current.setPosition(toLiteral(spot.position));
    vehicleRef.current.setIcon({
      path: maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale: 5.5,
      rotation: spot.heading,
      fillColor: colors.primary,
      fillOpacity: 1,
      strokeColor: isDark ? '#111A21' : '#FFFFFF',
      strokeWeight: 2.5,
    });
  }, [vehicleProgress, route, colors, isDark, mapReady]);

  /* ------------------------------ pulse effect ----------------------------- */

  useEffect(() => {
    if (vehicleProgress === null || vehicleProgress === undefined) return;
    let step = 0;
    const timer = setInterval(() => {
      const pulse = pulseRef.current;
      if (!pulse) return;
      step = (step + 1) % 30;
      const scale = 13 + Math.sin((step / 30) * Math.PI * 2) * 5;
      const icon = pulse.getIcon();
      pulse.setIcon({ ...icon, scale, fillOpacity: 0.3 - (scale - 13) / 60 });
    }, 70);
    return () => clearInterval(timer);
  }, [vehicleProgress === null || vehicleProgress === undefined]);

  if (failed) return null;

  return (
    <View
      testID={testID}
      // react-native-web forwards this ref to the underlying DOM node.
      ref={containerRef as any}
      accessibilityLabel="Interactive ride map"
      style={[StyleSheet.absoluteFillObject, styles.container]}
    />
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
});

export default forwardRef(InteractiveRideMapWeb);
