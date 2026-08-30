import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import InteractiveRideMap from './InteractiveRideMap';
import type { InteractiveRideMapHandle } from './InteractiveRideMap.types';
import {
  StaticRouteFallback,
  type StaticRouteFallbackHandle,
} from './maps/StaticRouteFallback';
import { formatClock, formatDistance, formatDuration } from './maps/geometry';
import { useRideRoute, type RideRoute } from './maps/useRideRoute';
import type { RouteLegKind } from './maps/types';
import * as haptics from './haptics';
import { acquireScrollLock, releaseScrollLock } from './scrollLock';
import { rideWaypoints } from './routeData';
import type { Ride } from '@/data/mock';
import { useColors, useIsDark } from '@/hooks/useColors';
import { useDeviceLocation } from '@/hooks/useDeviceLocation';
import { useRideTracking } from '@/hooks/useRideTracking';

export type RideMapMode = 'route' | 'journey';

/**
 * How fast the simulated live vehicle moves relative to real time.
 * One real second ≈ 20 trip seconds, so the marker visibly crawls along the
 * route instead of appearing frozen, without racing to the destination.
 */
const LIVE_SPEEDUP = 20;
const LIVE_START_PROGRESS = 0.34;

function useLiveProgress(active: boolean, durationSeconds: number) {
  const [progress, setProgress] = useState(active ? LIVE_START_PROGRESS : null);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (!active) {
      setProgress(null);
      return;
    }
    startedAt.current = Date.now();
    setProgress(LIVE_START_PROGRESS);
    const timer = setInterval(() => {
      const elapsed = ((Date.now() - startedAt.current) / 1000) * LIVE_SPEEDUP;
      const fraction = durationSeconds > 0 ? elapsed / durationSeconds : 0;
      setProgress(Math.min(0.99, LIVE_START_PROGRESS + fraction));
    }, 1000);
    return () => clearInterval(timer);
  }, [active, durationSeconds]);

  return progress;
}

/* -------------------------------------------------------------------------- */
/*  Map surface                                                               */
/* -------------------------------------------------------------------------- */

type SurfaceProps = {
  route: RideRoute;
  width: number;
  height: number;
  fullScreen: boolean;
  interactive: boolean;
  showTraffic: boolean;
  vehicleProgress: number | null;
  vehiclePosition?: { latitude: number; longitude: number; heading?: number | null } | null;
  riderPosition?: { latitude: number; longitude: number } | null;
  testID?: string;
  onOpen?: () => void;
  onZoom?: (percent: number) => void;
  onUserInteraction?: () => void;
  focusedLeg?: RouteLegKind | null;
  mapRef: React.MutableRefObject<InteractiveRideMapHandle | null>;
  fallbackRef: React.MutableRefObject<StaticRouteFallbackHandle | null>;
  onFallbackChange?: (reason: string | null) => void;
};

function RideMapSurface({
  route,
  width,
  height,
  fullScreen,
  interactive,
  showTraffic,
  vehicleProgress,
  vehiclePosition = null,
  riderPosition = null,
  testID,
  onOpen,
  onZoom,
  onUserInteraction,
  focusedLeg = null,
  mapRef,
  fallbackRef,
  onFallbackChange,
}: SurfaceProps) {
  const colors = useColors();
  const isDark = useIsDark();
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const handleUnavailable = useCallback(
    (reason: string) => {
      setUnavailable(reason);
      onFallbackChange?.(reason);
    },
    [onFallbackChange],
  );

  if (unavailable) {
    return (
      <StaticRouteFallback
        route={route}
        colors={colors}
        width={width}
        height={height}
        fullScreen={fullScreen}
        interactive={interactive}
        onOpen={onOpen}
        onScaleChange={(scale) => onZoom?.(Math.round(scale * 100))}
        controlRef={fallbackRef}
      />
    );
  }

  return (
    <>
      <InteractiveRideMap
        ref={mapRef}
        testID={testID}
        route={route}
        colors={colors}
        isDark={isDark}
        // The caller decides. The full-screen map owns the whole screen so it
        // is always interactive; the preview card turns gestures on only while
        // "Explore" is active, because a pannable map inside a ScrollView
        // otherwise swallows the page's own vertical scroll.
        interactive={interactive}
        cooperativeGestures={!fullScreen}
        showTraffic={showTraffic}
        vehicleProgress={vehicleProgress}
        vehiclePosition={vehiclePosition}
        riderPosition={riderPosition}
        onPress={onOpen}
        onReady={() => setReady(true)}
        onZoomChange={(zoom, baseZoom) =>
          onZoom?.(Math.max(10, Math.round(2 ** (zoom - baseZoom) * 100)))
        }
        onUserInteraction={onUserInteraction}
        focusedLeg={focusedLeg}
        onUnavailable={handleUnavailable}
      />
      {!ready && (
        <View
          pointerEvents="none"
          style={[styles.surfaceLoading, { backgroundColor: colors.secondary }]}
        >
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading route</Text>
        </View>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Controls                                                                  */
/* -------------------------------------------------------------------------- */

function ControlButton({
  icon,
  label,
  onPress,
  active = false,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      testID={`map-${label.toLowerCase().replaceAll(' ', '-')}`}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.controlButton,
        {
          backgroundColor: active ? colors.charcoal : 'transparent',
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={17} color={active ? colors.background : colors.charcoal} />
    </Pressable>
  );
}

function MapControls({
  zoomPercent,
  colors,
  onZoom,
  onFit,
  onToggleTraffic,
  trafficOn,
  onToggleExplore,
  exploreOn,
  vertical = false,
}: {
  zoomPercent: number;
  colors: ReturnType<typeof useColors>;
  onZoom: (delta: number) => void;
  onFit: () => void;
  onToggleTraffic?: () => void;
  trafficOn?: boolean;
  /** Preview only: hand the touches to the map and freeze the page scroll. */
  onToggleExplore?: () => void;
  exploreOn?: boolean;
  vertical?: boolean;
}) {
  return (
    <View style={vertical ? styles.controlsColumn : styles.controlsRow}>
      <View
        style={[
          vertical ? styles.controlGroupColumn : styles.controlGroupRow,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <ControlButton icon="add" label="Zoom in" onPress={() => onZoom(1)} colors={colors} />
        <View
          style={[
            vertical ? styles.controlDividerH : styles.controlDividerV,
            { backgroundColor: colors.border },
          ]}
        />
        <ControlButton icon="remove" label="Zoom out" onPress={() => onZoom(-1)} colors={colors} />
      </View>
      <View
        style={[
          vertical ? styles.controlGroupColumn : styles.controlGroupRow,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <ControlButton icon="scan-outline" label="Fit route" onPress={onFit} colors={colors} />
        {onToggleTraffic && (
          <>
            <View
              style={[
                vertical ? styles.controlDividerH : styles.controlDividerV,
                { backgroundColor: colors.border },
              ]}
            />
            <ControlButton
              icon="car-outline"
              label="Traffic"
              onPress={onToggleTraffic}
              active={trafficOn}
              colors={colors}
            />
          </>
        )}
        {onToggleExplore && (
          <>
            <View
              style={[
                vertical ? styles.controlDividerH : styles.controlDividerV,
                { backgroundColor: colors.border },
              ]}
            />
            <ControlButton
              icon="hand-left-outline"
              label="Explore"
              onPress={onToggleExplore}
              active={exploreOn}
              colors={colors}
            />
          </>
        )}
      </View>
      {!vertical && (
        <View style={[styles.zoomChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.zoomValue, { color: colors.mutedForeground }]}>{zoomPercent}%</Text>
        </View>
      )}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Journey segments                                                          */
/* -------------------------------------------------------------------------- */

const LEG_LABEL: Record<string, string> = {
  pickup: 'To pickup',
  journey: 'Main leg',
  arrival: 'To drop-off',
};

/**
 * The three-colour progress bar, made to do something.
 *
 * It was decorative: fixed 1:4:1 proportions and no distances, so it told you
 * nothing the map did not. Now each bar is sized by that leg's real share of
 * the distance, carries its own distance label, and zooms the map to that leg
 * when tapped — which is the obvious thing to try, and previously did nothing.
 */
function JourneySegments({
  route,
  colors,
  progress,
  focusedLeg,
  onFocusLeg,
}: {
  route: RideRoute;
  colors: ReturnType<typeof useColors>;
  progress: number | null;
  focusedLeg: RouteLegKind | null;
  onFocusLeg: (leg: RouteLegKind | null) => void;
}) {
  const tone: Record<string, string> = {
    pickup: colors.routePurple,
    journey: colors.routeOrange,
    arrival: colors.routeGreen,
  };

  // A ride whose driver has not pinned a separate pickup produces legs of zero
  // length. Showing them gives a tappable "0 m" column that zooms to nothing.
  const drawable = route.legs.filter(
    (leg) => leg.distanceMeters > 0 && leg.coordinates.length > 1,
  );
  const total = drawable.reduce((sum, leg) => sum + leg.distanceMeters, 0) || 1;

  if (!drawable.length) return null;

  return (
    <View style={styles.segmentBlock}>
      <View style={styles.segmentRow}>
        {drawable.map((leg) => {
          const share = leg.distanceMeters / total;
          const active = focusedLeg === leg.kind;
          const dimmed = focusedLeg !== null && !active;
          return (
            <Pressable
              key={leg.kind}
              accessibilityRole="button"
              accessibilityLabel={`${LEG_LABEL[leg.kind] ?? leg.kind}, ${formatDistance(
                leg.distanceMeters,
              )}. Zoom the map to this leg.`}
              accessibilityState={{ selected: active }}
              testID={`segment-${leg.kind}`}
              onPress={() => {
                haptics.tap();
                onFocusLeg(active ? null : leg.kind);
              }}
              // Minimum flex so a 2 km hop stays tappable next to a 140 km one.
              style={[styles.segmentColumn, { flex: Math.max(share, 0.14) }]}
            >
              <View
                style={[
                  styles.segmentBar,
                  {
                    backgroundColor: tone[leg.kind] ?? colors.routeOrange,
                    opacity: dimmed ? 0.3 : 1,
                    height: active ? 9 : 6,
                  },
                ]}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.segmentDistance,
                  { color: active ? colors.charcoal : colors.mutedForeground },
                ]}
              >
                {formatDistance(leg.distanceMeters)}
              </Text>
              <Text numberOfLines={1} style={[styles.segmentCaption, { color: colors.mutedForeground }]}>
                {LEG_LABEL[leg.kind] ?? leg.kind}
              </Text>
            </Pressable>
          );
        })}

        {progress !== null && (
          <View
            pointerEvents="none"
            style={[
              styles.segmentMarker,
              { left: `${Math.round(progress * 100)}%`, backgroundColor: colors.charcoal },
            ]}
          />
        )}
      </View>

      <Text style={[styles.segmentHint, { color: colors.mutedForeground }]}>
        {focusedLeg ? 'Tap again to see the whole route' : 'Tap a segment to zoom to it'}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Shared trip readout                                                       */
/* -------------------------------------------------------------------------- */

function useTripReadout(route: RideRoute, progress: number | null) {
  return useMemo(() => {
    const total = route.durationInTrafficSeconds ?? route.durationSeconds;
    const remaining = progress === null ? total : Math.max(0, total * (1 - progress));
    const arrival = new Date(Date.now() + remaining * 1000);
    return {
      totalLabel: formatDuration(total),
      remainingLabel: formatDuration(remaining),
      arrivalLabel: formatClock(arrival),
      distanceLabel: formatDistance(route.distanceMeters),
      delayMinutes: Math.round(route.trafficDelaySeconds / 60),
      isLive: route.source === 'directions',
    };
  }, [route, progress]);
}

/* -------------------------------------------------------------------------- */
/*  Preview card                                                              */
/* -------------------------------------------------------------------------- */

export function RideMapPreview({
  ride,
  mode = 'route',
  rideApiId = null,
  vehicle: suppliedVehicle,
}: {
  ride: Ride;
  mode?: RideMapMode;
  /** Numeric API id, when this ride came from the server. Enables tracking. */
  rideApiId?: number | null;
  /**
   * A vehicle position supplied by the caller.
   *
   * Passing this (even as null) turns off the internal poller: the live
   * tracking screen already follows the ride for its own readouts, and two
   * pollers on one endpoint means twice the requests and two markers a few
   * seconds out of step with each other.
   */
  vehicle?: { latitude: number; longitude: number; heading?: number | null } | null;
}) {
  const colors = useColors();
  const { width, height } = useWindowDimensions();
  // The ride's own coordinates, not a lookup keyed by its id. Memoised because
  // the hook re-fetches whenever these change.
  const waypoints = useMemo(() => rideWaypoints(ride), [ride]);
  const { route, status, reason, refresh } = useRideRoute(ride.id, waypoints, {
    refreshMs: mode === 'journey' ? 120000 : 0,
  });
  const mapRef = useRef<InteractiveRideMapHandle | null>(null);
  const fallbackRef = useRef<StaticRouteFallbackHandle | null>(null);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [traffic, setTraffic] = useState(mode === 'journey');
  // Map gestures inside a scrolling page have to be opt-in: a MapView that
  // accepts drags inside a ScrollView eats the page's vertical scroll. While
  // Explore is on the map takes the touches and the screen below stops
  // scrolling; the zoom buttons work either way.
  const [explore, setExplore] = useState(false);
  useEffect(() => {
    if (!explore) return;
    acquireScrollLock();
    return releaseScrollLock;
  }, [explore]);

  // Half the viewport, so the route actually has room to breathe.
  const mapHeight = Math.round(Math.min(Math.max(height * 0.42, 260), 420));
  const mapWidth = Math.min(width, 560) - 40;

  const progress = useLiveProgress(mode === 'journey', route.durationSeconds);
  const readout = useTripReadout(route, progress);

  // Live positions, but only on a journey — a route preview has no vehicle to
  // follow and no reason to ask for the location permission.
  const live = mode === 'journey';
  const owned = suppliedVehicle === undefined;
  const { vehicle: polled } = useRideTracking(rideApiId, live && owned);
  const { position: rider } = useDeviceLocation({ enabled: live });

  const marker = owned
    ? polled?.isLive
      ? {
          latitude: polled.latitude,
          longitude: polled.longitude,
          heading: polled.headingDegrees,
        }
      : null
    : (suppliedVehicle ?? null);

  const openActivity = useCallback(() => {
    haptics.press();
    router.push({ pathname: '/map', params: { ride: ride.id, mode } });
  }, [ride.id, mode]);

  const zoom = (delta: number) => {
    mapRef.current?.zoomBy(delta);
    fallbackRef.current?.zoomBy(delta * 0.3);
  };
  const fit = () => {
    mapRef.current?.fitRoute(true);
    fallbackRef.current?.fitRoute();
    setZoomPercent(100);
  };

  return (
    <View style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.previewHeader}>
        <View style={styles.previewTitleWrap}>
          <View
            style={[
              styles.liveBadge,
              { backgroundColor: mode === 'journey' ? colors.greenSoft : colors.accent },
            ]}
          >
            <View
              style={[
                styles.liveDot,
                { backgroundColor: mode === 'journey' ? colors.green : colors.primary },
              ]}
            />
            <Text
              style={[
                styles.liveText,
                { color: mode === 'journey' ? colors.green : colors.accentForeground },
              ]}
            >
              {mode === 'journey' ? 'LIVE JOURNEY' : 'ROUTE PREVIEW'}
            </Text>
          </View>
          <Text style={[styles.previewTitle, { color: colors.charcoal }]}>
            {mode === 'journey' ? 'Follow your route' : 'See the full route'}
          </Text>
          <Text style={[styles.previewMeta, { color: colors.mutedForeground }]}>
            {readout.distanceLabel} · {readout.totalLabel}
            {readout.delayMinutes > 0 ? ` · +${readout.delayMinutes}m traffic` : ''}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open full-screen map"
          testID="map-expand"
          onPress={openActivity}
          style={({ pressed }) => [
            styles.expandButton,
            { backgroundColor: colors.secondary, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="expand-outline" size={17} color={colors.charcoal} />
        </Pressable>
      </View>

      <View style={[styles.previewViewport, { height: mapHeight }]}>
        <RideMapSurface
          route={route}
          width={mapWidth}
          height={mapHeight}
          fullScreen={false}
          interactive={explore}
          showTraffic={traffic}
          vehicleProgress={progress}
          vehiclePosition={marker}
          riderPosition={rider ? { latitude: rider.latitude, longitude: rider.longitude } : null}
          testID="interactive-ride-map"
          // While exploring, a tap belongs to the map, not to navigation.
          onOpen={explore ? undefined : openActivity}
          onZoom={setZoomPercent}
          mapRef={mapRef}
          fallbackRef={fallbackRef}
        />

        <View style={styles.previewOverlay} pointerEvents="box-none">
          <View style={styles.previewOverlayTop} pointerEvents="box-none">
            {status === 'loading' && (
              <View style={[styles.statusChip, { backgroundColor: colors.card }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.statusChipText, { color: colors.mutedForeground }]}>
                  Fetching live route
                </Text>
              </View>
            )}
            {status === 'degraded' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry live route"
                onPress={refresh}
                style={[styles.statusChip, { backgroundColor: colors.card }]}
              >
                <Ionicons name="refresh" size={12} color={colors.primary} />
                <Text
                  numberOfLines={2}
                  style={[styles.statusChipText, { color: colors.mutedForeground }]}
                >
                  {reason ? `Straight-line route · ${reason}` : 'Approximate route · retry'}
                </Text>
              </Pressable>
            )}
          </View>

          <View style={styles.previewOverlayBottom} pointerEvents="box-none">
            <View style={[styles.etaChip, { backgroundColor: colors.card }]}>
              <Ionicons
                name={mode === 'journey' ? 'navigate' : 'time-outline'}
                size={13}
                color={mode === 'journey' ? colors.green : colors.primary}
              />
              <Text style={[styles.etaText, { color: colors.charcoal }]}>
                {mode === 'journey'
                  ? `${readout.remainingLabel} left · arrives ${readout.arrivalLabel}`
                  : explore
                    ? 'Drag to pan · pinch to zoom'
                    : 'Tap for full map · Explore to pan here'}
              </Text>
            </View>
            <MapControls
              zoomPercent={zoomPercent}
              colors={colors}
              onZoom={zoom}
              onFit={fit}
              onToggleTraffic={() => setTraffic((value) => !value)}
              trafficOn={traffic}
              onToggleExplore={() => setExplore((value) => !value)}
              exploreOn={explore}
              vertical
            />
          </View>
        </View>
      </View>

      <View style={[styles.previewFooter, { borderTopColor: colors.border }]}>
        <View style={styles.legend}>
          <View style={[styles.legendLine, { backgroundColor: colors.routePurple }]} />
          <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Pickup</Text>
          <View style={[styles.legendLine, { backgroundColor: colors.routeOrange }]} />
          <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Journey</Text>
          <View style={[styles.legendLine, { backgroundColor: colors.routeGreen }]} />
          <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Arrival</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open full-screen map"
          onPress={openActivity}
          style={({ pressed }) => [styles.footerLink, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.footerLinkText, { color: colors.primary }]}>Full map</Text>
          <Ionicons name="arrow-forward" size={13} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Full-screen activity                                                      */
/* -------------------------------------------------------------------------- */

export function RideMapActivity({
  ride,
  mode = 'route',
  rideApiId = null,
  onClose,
}: {
  ride: Ride;
  mode?: RideMapMode;
  rideApiId?: number | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // The ride's own coordinates, not a lookup keyed by its id. Memoised because
  // the hook re-fetches whenever these change.
  const waypoints = useMemo(() => rideWaypoints(ride), [ride]);
  const { route, status, reason, refresh } = useRideRoute(ride.id, waypoints, {
    refreshMs: mode === 'journey' ? 120000 : 0,
  });
  const mapRef = useRef<InteractiveRideMapHandle | null>(null);
  const fallbackRef = useRef<StaticRouteFallbackHandle | null>(null);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [traffic, setTraffic] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [moved, setMoved] = useState(false);
  const [focusedLeg, setFocusedLeg] = useState<RouteLegKind | null>(null);

  const focusLeg = useCallback(
    (kind: RouteLegKind | null) => {
      setFocusedLeg(kind);
      if (!kind) {
        mapRef.current?.fitRoute(true);
        setMoved(false);
        return;
      }
      const leg = route.legs.find((item) => item.kind === kind);
      if (leg && leg.coordinates.length > 1) {
        mapRef.current?.fitCoordinates(leg.coordinates, true);
        setMoved(true);
      }
    },
    [route],
  );

  const progress = useLiveProgress(mode === 'journey', route.durationSeconds);
  const readout = useTripReadout(route, progress);

  const live = mode === 'journey';
  const { vehicle, waiting: awaitingDriver } = useRideTracking(rideApiId, live);
  const { position: rider } = useDeviceLocation({ enabled: live });

  const zoom = (delta: number) => {
    mapRef.current?.zoomBy(delta);
    fallbackRef.current?.zoomBy(delta * 0.3);
  };
  const fit = () => {
    mapRef.current?.fitRoute(true);
    fallbackRef.current?.fitRoute();
    setZoomPercent(100);
    setMoved(false);
    setFocusedLeg(null);
  };

  return (
    <View style={[styles.activity, { backgroundColor: colors.background }]}>
      {/* The map owns the whole screen — controls float on top of it. */}
      <View style={StyleSheet.absoluteFillObject}>
        <RideMapSurface
          route={route}
          width={width}
          height={height}
          fullScreen
          interactive
          showTraffic={traffic}
          vehicleProgress={progress}
          vehiclePosition={
            vehicle?.isLive
              ? {
                  latitude: vehicle.latitude,
                  longitude: vehicle.longitude,
                  heading: vehicle.headingDegrees,
                }
              : null
          }
          riderPosition={rider ? { latitude: rider.latitude, longitude: rider.longitude } : null}
          testID="activity-map"
          focusedLeg={focusedLeg}
          onZoom={setZoomPercent}
          onUserInteraction={() => setMoved(true)}
          mapRef={mapRef}
          fallbackRef={fallbackRef}
        />
      </View>

      <View
        style={[
          styles.activityOverlay,
          { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 12 },
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.activityTop} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close map"
            testID="map-close"
            onPress={() => {
              haptics.tap();
              onClose();
            }}
            style={({ pressed }) => [
              styles.activityButton,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name="arrow-back" size={20} color={colors.charcoal} />
          </Pressable>
          <View style={[styles.activityTitle, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text
              style={[
                styles.activityEyebrow,
                { color: mode === 'journey' ? colors.green : colors.primary },
              ]}
            >
              {mode === 'journey' ? 'LIVE JOURNEY' : 'ROUTE EXPLORER'}
            </Text>
            <Text numberOfLines={1} style={[styles.activityRoute, { color: colors.charcoal }]}>
              {ride.from} → {ride.to}
            </Text>
          </View>
          <MapControls
            zoomPercent={zoomPercent}
            colors={colors}
            onZoom={zoom}
            onFit={fit}
            onToggleTraffic={() => setTraffic((value) => !value)}
            trafficOn={traffic}
            vertical
          />
        </View>

        <View style={styles.activityMiddle} pointerEvents="box-none">
          {live && (awaitingDriver || vehicle) && (
            <View style={[styles.statusChip, { backgroundColor: colors.card, alignSelf: 'center' }]}>
              <View
                style={[
                  styles.liveDot,
                  { backgroundColor: vehicle?.isLive ? colors.green : colors.mutedForeground },
                ]}
              />
              <Text style={[styles.statusChipText, { color: colors.mutedForeground }]}>
                {awaitingDriver
                  ? 'Waiting for the driver to share their location'
                  : vehicle?.isLive
                    ? 'Live vehicle position'
                    : `Last seen ${Math.round((vehicle?.ageSeconds ?? 0) / 60)} min ago`}
              </Text>
            </View>
          )}
          {status === 'degraded' && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry live route"
              onPress={refresh}
              style={[styles.statusChip, { backgroundColor: colors.card, alignSelf: 'center' }]}
            >
              <Ionicons name="refresh" size={12} color={colors.primary} />
              <Text
                numberOfLines={2}
                style={[styles.statusChipText, { color: colors.mutedForeground }]}
              >
                {reason ? `Straight-line route · ${reason}` : 'Approximate route · tap to retry'}
              </Text>
            </Pressable>
          )}
          {moved && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Recenter on the route"
              testID="map-recenter"
              onPress={fit}
              style={({ pressed }) => [
                styles.recenter,
                { backgroundColor: colors.charcoal, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons name="locate" size={15} color={colors.background} />
              <Text style={[styles.recenterText, { color: colors.background }]}>Recenter</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.activityBottom} pointerEvents="box-none">
          <View style={[styles.routeInfo, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={expanded ? 'Collapse trip details' : 'Expand trip details'}
              onPress={() => {
                haptics.tap();
                setExpanded((value) => !value);
              }}
              style={styles.sheetHandleRow}
            >
              <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            </Pressable>

            <View style={styles.infoTop}>
              <View style={styles.infoTopCopy}>
                <Text style={[styles.infoEyebrow, { color: colors.mutedForeground }]}>
                  {mode === 'journey' ? 'ARRIVING' : 'TOTAL JOURNEY'}
                </Text>
                <Text style={[styles.infoTitle, { color: colors.charcoal }]}>
                  {mode === 'journey' ? readout.remainingLabel : readout.totalLabel}
                  <Text style={[styles.infoMuted, { color: colors.mutedForeground }]}>
                    {mode === 'journey' ? ` · ${readout.arrivalLabel}` : ` · ${readout.distanceLabel}`}
                  </Text>
                </Text>
              </View>
              <View
                style={[
                  styles.infoIcon,
                  { backgroundColor: mode === 'journey' ? colors.greenSoft : colors.accent },
                ]}
              >
                <Ionicons
                  name={mode === 'journey' ? 'navigate' : 'map-outline'}
                  size={18}
                  color={mode === 'journey' ? colors.green : colors.primary}
                />
              </View>
            </View>

            <JourneySegments
              route={route}
              colors={colors}
              progress={progress}
              focusedLeg={focusedLeg}
              onFocusLeg={focusLeg}
            />

            {expanded && (
              <>
                <View style={[styles.statRow, { borderTopColor: colors.border }]}>
                  <View style={styles.stat}>
                    <Text style={[styles.statValue, { color: colors.charcoal }]}>
                      {readout.distanceLabel}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Distance</Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.stat}>
                    <Text style={[styles.statValue, { color: colors.charcoal }]}>
                      {readout.delayMinutes > 0 ? `+${readout.delayMinutes}m` : 'Clear'}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Traffic</Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.stat}>
                    <Text style={[styles.statValue, { color: colors.charcoal }]}>
                      {ride.driver.name.split(' ')[0]}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Driver</Text>
                  </View>
                </View>
                <View style={styles.waypointList}>
                  <View style={styles.waypointRow}>
                    <View style={[styles.waypointDot, { backgroundColor: colors.routeOrangeMarker }]} />
                    <Text numberOfLines={1} style={[styles.waypointText, { color: colors.charcoal }]}>
                      {ride.pickup}
                    </Text>
                  </View>
                  <View style={[styles.waypointConnector, { backgroundColor: colors.border }]} />
                  <View style={styles.waypointRow}>
                    <View style={[styles.waypointDot, { backgroundColor: colors.routeGreenMarker }]} />
                    <Text numberOfLines={1} style={[styles.waypointText, { color: colors.charcoal }]}>
                      {ride.dropoff}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.infoHint, { color: colors.mutedForeground }]}>
                  {readout.isLive
                    ? 'Live road geometry and traffic from Google Maps.'
                    : 'Showing an approximate route — live data is unavailable.'}
                </Text>
              </>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */

const shadow = Platform.select({
  web: { boxShadow: '0 6px 20px rgba(0,0,0,0.12)' },
  default: {
    shadowColor: '#000',
    shadowOpacity: 0.13,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
}) as object;

const styles = StyleSheet.create({
  segmentBlock: { marginTop: 4 },
  segmentColumn: { paddingRight: 6 },
  segmentBar: { borderRadius: 5, marginBottom: 7 },
  segmentDistance: { fontFamily: 'Inter_700Bold', fontSize: 11.5 },
  segmentCaption: { fontFamily: 'Inter_400Regular', fontSize: 9.5, marginTop: 2 },
  segmentHint: { fontFamily: 'Inter_400Regular', fontSize: 9.5, marginTop: 10 },
  /* preview */
  previewCard: { borderWidth: 1, borderRadius: 22, overflow: 'hidden', marginBottom: 16 },
  previewHeader: {
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 11,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  previewTitleWrap: { flex: 1 },
  liveBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 0.8 },
  previewTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, letterSpacing: -0.2 },
  previewMeta: { fontFamily: 'Inter_500Medium', fontSize: 11, marginTop: 3 },
  expandButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewViewport: { overflow: 'hidden', position: 'relative' },
  previewOverlay: { ...StyleSheet.absoluteFillObject, padding: 12, justifyContent: 'space-between' },
  previewOverlayTop: { flexDirection: 'row' },
  previewOverlayBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 11,
    paddingHorizontal: 9,
    paddingVertical: 6,
    maxWidth: '92%',
    ...shadow,
  },
  statusChipText: { flexShrink: 1, fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  etaChip: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    ...shadow,
  },
  etaText: { fontFamily: 'Inter_600SemiBold', fontSize: 10.5 },
  surfaceLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  previewFooter: {
    minHeight: 48,
    borderTopWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, flexWrap: 'wrap' },
  legendLine: { width: 16, height: 4, borderRadius: 2, marginLeft: 3 },
  legendText: { fontFamily: 'Inter_500Medium', fontSize: 9 },
  footerLink: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingLeft: 8 },
  footerLinkText: { fontFamily: 'Inter_700Bold', fontSize: 11 },

  /* controls */
  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  controlsColumn: { alignItems: 'center', gap: 8 },
  controlGroupRow: { flexDirection: 'row', borderRadius: 13, borderWidth: 1, overflow: 'hidden', ...shadow },
  controlGroupColumn: { borderRadius: 13, borderWidth: 1, overflow: 'hidden', ...shadow },
  controlButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  controlDividerV: { width: 1, height: '100%' },
  controlDividerH: { height: 1, width: '100%' },
  zoomChip: { borderRadius: 11, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 7 },
  zoomValue: { fontFamily: 'Inter_700Bold', fontSize: 10, minWidth: 36, textAlign: 'center' },

  /* activity */
  activity: { flex: 1 },
  activityOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', paddingHorizontal: 14 },
  activityTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  activityButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  activityTitle: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 7,
    ...shadow,
  },
  activityEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 1 },
  activityRoute: { fontFamily: 'Inter_700Bold', fontSize: 14, marginTop: 2 },
  activityMiddle: { gap: 8, alignItems: 'center' },
  recenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    ...shadow,
  },
  recenterText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  activityBottom: { gap: 10 },
  routeInfo: { borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, paddingBottom: 16, ...shadow },
  sheetHandleRow: { alignItems: 'center', paddingVertical: 10 },
  sheetHandle: { width: 38, height: 4, borderRadius: 2 },
  infoTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  infoTopCopy: { flex: 1 },
  infoEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 1 },
  infoTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, marginTop: 4 },
  infoMuted: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  infoIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  // Top-aligned so every leg's bar sits on one line regardless of label length.
  segmentRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 16 },
  segmentMarker: {
    position: 'absolute',
    top: -2,
    width: 4,
    height: 10,
    borderRadius: 2,
    marginLeft: -2,
  },
  statRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, marginTop: 16, paddingTop: 14 },
  stat: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 9 },
  statDivider: { width: 1, height: 26 },
  waypointList: { marginTop: 15 },
  waypointRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  waypointDot: { width: 9, height: 9, borderRadius: 5 },
  waypointConnector: { width: 2, height: 14, marginLeft: 3.5, marginVertical: 2 },
  waypointText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12 },
  infoHint: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 13, lineHeight: 15 },
});
