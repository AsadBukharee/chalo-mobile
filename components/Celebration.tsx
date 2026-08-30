import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

/**
 * A confetti burst, for the two moments in the app that earn one: a rider
 * coming back, and a seat that has just been booked.
 *
 * Hand-rolled rather than pulled from a package on purpose. Confetti is a few
 * dozen views on a timing curve, and this build is already carrying more
 * native modules than it wants — a dependency here would cost a rebuild and
 * another entry in the Gradle graph for something the platform can do itself.
 *
 * Every value that moves is driven natively, so the animation keeps running at
 * sixty frames while JavaScript is busy fetching the account behind it. It
 * mounts, plays once, and stops: it never loops, and it never blocks a touch.
 */

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const PIECE_COUNT = 44;
const FALL_MS = 2600;

type Piece = {
  id: number;
  /** Where it starts across the screen, in px. */
  startX: number;
  /** How far it drifts sideways over the fall. */
  drift: number;
  delay: number;
  duration: number;
  width: number;
  height: number;
  /** Full turns it makes on the way down. */
  spins: number;
  radius: number;
  colour: string;
};

/**
 * Deterministic per-index pseudo-randomness.
 *
 * Math.random would re-roll on every render and, worse, occasionally clump
 * every piece into one corner. A hash of the index spreads them evenly and
 * makes the burst look the same each time it plays.
 */
function noise(index: number, salt: number): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export function Celebration({
  /** Play it. Flip false → true to replay. */
  active = true,
  /** Called once the last piece has landed, for chaining a navigation. */
  onDone,
}: {
  active?: boolean;
  onDone?: () => void;
}) {
  const colors = useColors();
  const [reduceMotion, setReduceMotion] = useState(false);

  // Someone who has asked the OS for less motion gets none of this. Confetti
  // is decoration; for a person with vestibular sensitivity it is a symptom.
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (!cancelled) setReduceMotion(enabled);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => setReduceMotion(enabled),
    );
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  // The route colours, not the surface ones: `accent` and `secondary` are pale
  // by design and vanish against the cream background they would fall onto.
  const palette = useMemo(
    () => [
      colors.primary,
      colors.green,
      colors.routeYellow,
      colors.routePink,
      colors.routeIndigo,
      colors.routePurpleMarker,
    ],
    [
      colors.primary,
      colors.green,
      colors.routeYellow,
      colors.routePink,
      colors.routeIndigo,
      colors.routePurpleMarker,
    ],
  );

  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: PIECE_COUNT }, (_, index) => {
        const ribbon = noise(index, 5) > 0.55;
        const size = 7 + noise(index, 6) * 6;
        return {
          id: index,
          startX: noise(index, 1) * SCREEN_WIDTH,
          // Pieces on the left drift right and vice versa, so the burst opens
          // outward instead of raining straight down.
          drift: (noise(index, 2) - 0.5) * 260,
          delay: noise(index, 3) * 700,
          duration: FALL_MS * (0.72 + noise(index, 4) * 0.5),
          width: size,
          height: ribbon ? size * 2.1 : size,
          spins: 1 + noise(index, 7) * 3,
          radius: ribbon ? 2 : size / 2,
          colour: palette[index % palette.length]!,
        };
      }),
    [palette],
  );

  // One driver per piece, 0 → 1 over its own fall.
  const progress = useRef(pieces.map(() => new Animated.Value(0))).current;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active || reduceMotion) return;

    setVisible(true);
    progress.forEach((value) => value.setValue(0));

    const animation = Animated.parallel(
      pieces.map((piece, index) =>
        Animated.timing(progress[index]!, {
          toValue: 1,
          duration: piece.duration,
          delay: piece.delay,
          // Gravity, roughly: slow off the top, quick at the bottom.
          easing: Easing.bezier(0.25, 0.1, 0.4, 1),
          useNativeDriver: true,
        }),
      ),
    );

    animation.start(({ finished }) => {
      if (!finished) return;
      setVisible(false);
      onDone?.();
    });

    return () => animation.stop();
    // `pieces` and `progress` are stable for the life of the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reduceMotion]);

  if (!visible || reduceMotion) return null;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      // Purely decorative: a screen reader should never land on 44 rectangles.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {pieces.map((piece, index) => {
        const driver = progress[index]!;
        return (
          <Animated.View
            key={piece.id}
            style={[
              styles.piece,
              {
                left: piece.startX,
                width: piece.width,
                height: piece.height,
                borderRadius: piece.radius,
                backgroundColor: piece.colour,
                opacity: driver.interpolate({
                  // Fade in fast, hold, then fade out before it lands, so
                  // nothing ever visibly stacks at the bottom edge.
                  inputRange: [0, 0.08, 0.75, 1],
                  outputRange: [0, 1, 1, 0],
                }),
                transform: [
                  {
                    translateY: driver.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-60, SCREEN_HEIGHT * 0.9],
                    }),
                  },
                  {
                    translateX: driver.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, piece.drift],
                    }),
                  },
                  {
                    rotate: driver.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', `${Math.round(piece.spins * 360)}deg`],
                    }),
                  },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', top: 0 },
});
