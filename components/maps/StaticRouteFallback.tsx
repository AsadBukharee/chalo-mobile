import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  GestureResponderEvent,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { useColors } from '@/hooks/useColors';
import { staticMapUrl } from './api';
import type { LatLng } from './geometry';
import type { RideRoute } from './useRideRoute';

type Palette = ReturnType<typeof useColors>;

/**
 * Last-resort map surface for the WEB build only, used if the Maps JavaScript
 * SDK can't load (blocked network, or a referrer restriction on the key).
 *
 * The Android build never reaches this: react-native-maps renders natively and
 * has no equivalent failure mode. It still pans and zooms (transform-based) and
 * still draws the real route geometry over a Static Maps tile.
 */

/** Web-mercator projection of the route into the view box. */
function projectRoute(points: LatLng[], width: number, height: number, contain: boolean) {
  if (points.length === 0) return [];
  const lats = points.map((point) => point.latitude);
  const lngs = points.map((point) => point.longitude);
  const center = {
    latitude: (Math.max(...lats) + Math.min(...lats)) / 2,
    longitude: (Math.max(...lngs) + Math.min(...lngs)) / 2,
  };
  const worldSize = 256 * 2 ** 7;
  const toWorld = (point: LatLng) => {
    const sin = Math.sin((point.latitude * Math.PI) / 180);
    return {
      x: ((point.longitude + 180) / 360) * worldSize,
      y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * worldSize,
    };
  };
  const centerWorld = toWorld(center);
  const frameScale = contain
    ? Math.min(width / 640, height / 360)
    : Math.max(width / 640, height / 360);
  const frameWidth = 640 * frameScale;
  const frameHeight = 360 * frameScale;
  const frameLeft = (width - frameWidth) / 2;
  const frameTop = (height - frameHeight) / 2;
  return points.map((point) => {
    const world = toWorld(point);
    return {
      x: frameLeft + frameWidth / 2 + (world.x - centerWorld.x) * frameScale,
      y: frameTop + frameHeight / 2 + (world.y - centerWorld.y) * frameScale,
    };
  });
}

/** Real polylines can be hundreds of points; the SVG only needs the shape. */
function simplify(points: LatLng[], maxPoints: number) {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  const result = points.filter((_, index) => index % step === 0);
  const last = points[points.length - 1]!;
  if (result[result.length - 1] !== last) result.push(last);
  return result;
}

function toPathData(projected: { x: number; y: number }[]) {
  if (projected.length === 0) return '';
  return projected
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');
}

function RouteOverlay({
  route,
  width,
  height,
  contain,
  colors,
}: {
  route: RideRoute;
  width: number;
  height: number;
  contain: boolean;
  colors: Palette;
}) {
  const all = useMemo(() => simplify(route.coordinates, 220), [route]);
  const projectedAll = useMemo(
    () => projectRoute(all, width, height, contain),
    [all, width, height, contain],
  );

  const legPaths = useMemo(() => {
    // Project each leg inside the same frame as the full route so they line up.
    let cursor = 0;
    return route.legs.map((leg) => {
      const simplified = simplify(leg.coordinates, 90);
      const start = cursor;
      cursor += simplified.length;
      return { kind: leg.kind, points: simplified, start };
    });
  }, [route]);

  const legProjections = useMemo(() => {
    const combined = legPaths.flatMap((leg) => leg.points);
    const projected = projectRoute(combined, width, height, contain);
    let cursor = 0;
    return legPaths.map((leg) => {
      const slice = projected.slice(cursor, cursor + leg.points.length);
      cursor += leg.points.length;
      return { kind: leg.kind, projected: slice };
    });
  }, [legPaths, width, height, contain]);

  if (projectedAll.length === 0) return null;

  const tone: Record<string, { core: string; accent: string }> = {
    pickup: { core: colors.routePurple, accent: colors.routePurpleMarker },
    journey: { core: colors.routeOrange, accent: colors.routeOrangeMarker },
    arrival: { core: colors.routeGreen, accent: colors.routeGreenMarker },
  };

  const waypoints = projectRoute(
    [
      route.waypoints.rider,
      route.waypoints.pickup,
      route.waypoints.dropoff,
      route.waypoints.destination,
    ],
    width,
    height,
    contain,
  );

  const labels = [
    { point: waypoints[0], text: 'YOU', width: 34, fill: colors.routePurpleSoft, textColor: colors.routePurpleMarker, offset: 16 },
    { point: waypoints[1], text: 'PICKUP', width: 50, fill: colors.cream, textColor: colors.routeOrangeMarker, offset: -30 },
    { point: waypoints[2], text: 'DROP-OFF', width: 58, fill: colors.routeGreenSoft, textColor: colors.routeGreenMarker, offset: 16 },
    { point: waypoints[3], text: 'ARRIVE', width: 48, fill: colors.routeGreenSoft, textColor: colors.routeGreenMarker, offset: -30 },
  ].filter((label) => label.point);

  return (
    <Svg
      style={[StyleSheet.absoluteFillObject, { pointerEvents: 'none' }]}
      width={width}
      height={height}
    >
      {legProjections.map((leg) => (
        <Path
          key={`shadow-${leg.kind}`}
          d={toPathData(leg.projected)}
          stroke={colors.charcoal}
          strokeWidth="16"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.18"
        />
      ))}
      {legProjections.map((leg) => (
        <Path
          key={`halo-${leg.kind}`}
          d={toPathData(leg.projected)}
          stroke={colors.white}
          strokeWidth="11"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />
      ))}
      {legProjections.map((leg) => (
        <Path
          key={`core-${leg.kind}`}
          d={toPathData(leg.projected)}
          stroke={(tone[leg.kind] ?? tone.journey!).core}
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {legProjections.map((leg) => (
        <Path
          key={`accent-${leg.kind}`}
          d={toPathData(leg.projected)}
          stroke={(tone[leg.kind] ?? tone.journey!).accent}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.45"
        />
      ))}
      {waypoints.map((point, index) => {
        const fill =
          index === 0
            ? colors.routePurpleSoft
            : index === 1
              ? colors.cream
              : colors.routeGreenSoft;
        const stroke =
          index === 0
            ? colors.routePurpleMarker
            : index === 1
              ? colors.routeOrangeMarker
              : colors.routeGreenMarker;
        return (
          <React.Fragment key={`waypoint-${index}`}>
            <Circle cx={point.x} cy={point.y} r="12" fill={fill} stroke={stroke} strokeWidth="3" />
            <Circle cx={point.x} cy={point.y} r="4" fill={stroke} />
          </React.Fragment>
        );
      })}
      {labels.map((label) => (
        <React.Fragment key={label.text}>
          <Rect
            x={label.point!.x - label.width / 2}
            y={label.point!.y + label.offset}
            width={label.width}
            height="17"
            rx="8.5"
            fill={label.fill}
            opacity="0.98"
          />
          <SvgText
            x={label.point!.x}
            y={label.point!.y + label.offset + 12}
            textAnchor="middle"
            fill={label.textColor}
            fontSize="7.5"
            fontFamily="Inter_700Bold"
          >
            {label.text}
          </SvgText>
        </React.Fragment>
      ))}
    </Svg>
  );
}

function DecorativeMap({ width, height, colors }: { width: number; height: number; colors: Palette }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 400 218">
      <Rect x="0" y="0" width="400" height="218" fill={colors.secondary} />
      <Path d="M-25 42 C 70 73 98 36 174 54 S 310 34 427 69" stroke={colors.card} strokeWidth="14" fill="none" strokeLinecap="round" opacity="0.8" />
      <Path d="M-20 185 C 69 152 103 178 163 144 S 292 155 420 117" stroke={colors.card} strokeWidth="11" fill="none" strokeLinecap="round" opacity="0.8" />
      <Path d="M86 -15 C 123 46 114 87 141 123 S 168 182 203 232" stroke={colors.card} strokeWidth="9" fill="none" strokeLinecap="round" opacity="0.8" />
      <Path d="M274 -12 C 245 43 282 76 267 108 S 303 170 286 231" stroke={colors.card} strokeWidth="8" fill="none" strokeLinecap="round" opacity="0.8" />
    </Svg>
  );
}

function touchDistance(event: GestureResponderEvent) {
  const touches = event.nativeEvent.touches;
  if (touches.length < 2) return 0;
  return Math.hypot(touches[0]!.pageX - touches[1]!.pageX, touches[0]!.pageY - touches[1]!.pageY);
}

function touchCenter(event: GestureResponderEvent) {
  const touches = event.nativeEvent.touches;
  if (touches.length < 2) return { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
  return {
    x: (touches[0]!.pageX + touches[1]!.pageX) / 2,
    y: (touches[0]!.pageY + touches[1]!.pageY) / 2,
  };
}

export type StaticRouteFallbackHandle = {
  fitRoute: () => void;
  zoomBy: (delta: number) => void;
};

export function StaticRouteFallback({
  route,
  colors,
  width,
  height,
  fullScreen,
  interactive,
  onOpen,
  onScaleChange,
  controlRef,
}: {
  route: RideRoute;
  colors: Palette;
  width: number;
  height: number;
  fullScreen: boolean;
  interactive: boolean;
  onOpen?: () => void;
  onScaleChange?: (scale: number) => void;
  controlRef?: React.MutableRefObject<StaticRouteFallbackHandle | null>;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const gestureStart = useRef({ scale: 1, x: 0, y: 0, distance: 0, centerX: 0, centerY: 0 });
  const touchStart = useRef({ time: 0 });

  // Built directly against Google — image loads aren't CORS-restricted, so this
  // needs no backend on either platform.
  const imageUri = useMemo(
    () =>
      staticMapUrl({
        width: fullScreen ? 640 : 640,
        height: fullScreen ? 640 : 360,
        path: route.coordinates.map((point) => ({ lat: point.latitude, lng: point.longitude })),
        markers: [
          { lat: route.waypoints.pickup.latitude, lng: route.waypoints.pickup.longitude, color: 'orange' },
          { lat: route.waypoints.dropoff.latitude, lng: route.waypoints.dropoff.longitude, color: 'green' },
        ],
      }),
    [route, fullScreen],
  );

  useEffect(() => {
    setImageState(imageUri ? 'loading' : 'failed');
  }, [imageUri]);

  const clamp = (next: { x: number; y: number }, nextScale: number) => ({
    x: Math.max(-((nextScale - 1) * width) / 2, Math.min(((nextScale - 1) * width) / 2, next.x)),
    y: Math.max(-((nextScale - 1) * height) / 2, Math.min(((nextScale - 1) * height) / 2, next.y)),
  });

  const apply = (nextScale: number, nextOffset: { x: number; y: number }) => {
    scaleRef.current = nextScale;
    offsetRef.current = nextOffset;
    setScale(nextScale);
    setOffset(nextOffset);
    onScaleChange?.(nextScale);
  };

  if (controlRef) {
    controlRef.current = {
      fitRoute: () => apply(1, { x: 0, y: 0 }),
      zoomBy: (delta: number) => {
        const next = Math.max(1, Math.min(4, scaleRef.current + delta));
        apply(next, next === 1 ? { x: 0, y: 0 } : clamp(offsetRef.current, next));
      },
    };
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3,
      onPanResponderGrant: (event) => {
        const center = touchCenter(event);
        gestureStart.current = {
          scale: scaleRef.current,
          x: offsetRef.current.x,
          y: offsetRef.current.y,
          distance: touchDistance(event),
          centerX: center.x,
          centerY: center.y,
        };
        touchStart.current = { time: Date.now() };
      },
      onPanResponderMove: (event, gesture) => {
        const distance = touchDistance(event);
        if (distance && !gestureStart.current.distance) {
          const center = touchCenter(event);
          gestureStart.current.distance = distance;
          gestureStart.current.centerX = center.x;
          gestureStart.current.centerY = center.y;
        }
        if (distance && gestureStart.current.distance) {
          const nextScale = Math.max(
            1,
            Math.min(4, gestureStart.current.scale * (distance / gestureStart.current.distance)),
          );
          const center = touchCenter(event);
          apply(
            nextScale,
            clamp(
              {
                x: gestureStart.current.x + center.x - gestureStart.current.centerX,
                y: gestureStart.current.y + center.y - gestureStart.current.centerY,
              },
              nextScale,
            ),
          );
          return;
        }
        apply(
          scaleRef.current,
          clamp(
            { x: gestureStart.current.x + gesture.dx, y: gestureStart.current.y + gesture.dy },
            scaleRef.current,
          ),
        );
      },
      onPanResponderRelease: (_event, gesture) => {
        const moved = Math.hypot(gesture.dx, gesture.dy) > 8;
        if (!moved && Date.now() - touchStart.current.time < 450) onOpen?.();
        if (scaleRef.current <= 1.02) apply(1, { x: 0, y: 0 });
      },
    }),
  ).current;

  const handlers = interactive ? panResponder.panHandlers : {};

  return (
    <View {...handlers} style={StyleSheet.absoluteFillObject}>
      <View
        style={[
          styles.canvas,
          {
            width,
            height,
            transform: [{ translateX: offset.x }, { translateY: offset.y }, { scale }],
          },
        ]}
      >
        {imageState !== 'failed' && imageUri ? (
          <Image
            accessibilityLabel="Static route map"
            source={{ uri: imageUri }}
            style={StyleSheet.absoluteFillObject}
            resizeMode={fullScreen ? 'contain' : 'cover'}
            onLoad={() => setImageState('loaded')}
            onError={() => setImageState('failed')}
          />
        ) : (
          <DecorativeMap width={width} height={height} colors={colors} />
        )}
        <RouteOverlay route={route} width={width} height={height} contain={fullScreen} colors={colors} />
        {imageState === 'loading' && (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
      </View>
      <View style={[styles.badge, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>Static preview</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { position: 'absolute', top: 0, left: 0 },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 10,
    left: 10,
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 0.4 },
});
