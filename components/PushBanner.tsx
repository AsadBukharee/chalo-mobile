import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as haptics from './haptics';
import { firebaseMessaging, type PushMessage } from '@/lib/firebase';
import { useColors } from '@/hooks/useColors';

/**
 * In-app notification banner.
 *
 * Android and iOS draw notifications themselves only while the app is
 * backgrounded. A message that arrives with the app on screen fires
 * `onMessage` and displays nothing — so without this, a rider watching the app
 * is the one person who never sees the alert. This renders it.
 *
 * Taps on tray notifications (background, or a cold launch) are handled here
 * too, since routing on `data.type` belongs in one place.
 */

const VISIBLE_MS = 5000;

function routeFor(message: PushMessage) {
  switch (message.data?.type) {
    case 'booking':
      return '/(tabs)/trips' as const;
    case 'ride':
      return '/(tabs)' as const;
    default:
      return null;
  }
}

export function PushBanner() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<PushMessage | null>(null);
  const slide = useRef(new Animated.Value(-160)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(slide, {
      toValue: -160,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setMessage(null));
  }, [slide]);

  const show = useCallback(
    (next: PushMessage) => {
      if (!next.body && !next.title) return;
      haptics.tap();
      setMessage(next);
      slide.setValue(-160);
      Animated.spring(slide, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 6,
        speed: 14,
      }).start();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(hide, VISIBLE_MS);
    },
    [slide, hide],
  );

  const open = useCallback(
    (next: PushMessage) => {
      const target = routeFor(next);
      if (target) router.push(target);
    },
    [],
  );

  useEffect(() => {
    if (!firebaseMessaging.available) return;

    const unsubscribeMessage = firebaseMessaging.onMessage(show);
    const unsubscribeOpened = firebaseMessaging.onNotificationOpened(open);

    // A notification that launched the app from cold: route, don't re-display.
    firebaseMessaging.getInitialNotification().then((initial) => {
      if (initial) open(initial);
    });

    return () => {
      unsubscribeMessage();
      unsubscribeOpened();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [show, open]);

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { paddingTop: insets.top + 8, transform: [{ translateY: slide }] },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${message.title}. ${message.body}`}
        onPress={() => {
          hide();
          open(message);
        }}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={[styles.icon, { backgroundColor: colors.accent }]}>
          <Ionicons name="notifications" size={17} color={colors.primary} />
        </View>
        <View style={styles.copy}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.charcoal }]}>
            {message.title}
          </Text>
          {!!message.body && (
            <Text numberOfLines={2} style={[styles.body, { color: colors.mutedForeground }]}>
              {message.body}
            </Text>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
          onPress={hide}
          hitSlop={10}
        >
          <Ionicons name="close" size={17} color={colors.mutedForeground} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    zIndex: 100,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: 17,
    borderWidth: 1,
    padding: 13,
    // A floating banner needs to read as above the page, not part of it.
    shadowColor: '#000',
    shadowOpacity: 0.13,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 7,
  },
  icon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 11.5, lineHeight: 16, marginTop: 3 },
});
