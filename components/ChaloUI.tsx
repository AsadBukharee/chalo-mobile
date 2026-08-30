import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as haptics from './haptics';
import { useScrollLocked } from './scrollLock';
import { Ride } from '@/data/mock';
import { useColors } from '@/hooks/useColors';

/** Phone-shaped column so the app doesn't stretch across a desktop browser. */
const MAX_CONTENT_WIDTH = 560;

export function Screen({
  children,
  scroll = true,
  style,
  refreshing,
  onRefresh,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: object;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // A map on this screen can claim the touches while the user pans it; the
  // page must stop scrolling for the duration or the two fight each other.
  const scrollLocked = useScrollLocked();
  // Native uses the real safe-area inset; web has no notch, so a small pad.
  const top = Platform.OS === 'web' ? Math.max(insets.top, 16) : insets.top;
  const bottom = Platform.OS === 'web' ? 34 : insets.bottom;

  const content = (
    <View style={[styles.screenOuter, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.screen,
          { paddingTop: top + 12, paddingBottom: bottom + 92 },
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );

  if (!scroll) return content;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={!scrollLocked}
      contentContainerStyle={styles.scrollContent}
      style={{ backgroundColor: colors.background }}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={Boolean(refreshing)}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        ) : undefined
      }
    >
      {content}
    </ScrollView>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.logoRow} accessible accessibilityLabel="Chalo">
      <View style={[styles.logoMark, { backgroundColor: colors.primary }]}>
        <Text style={[styles.logoUrdu, { color: colors.charcoal }]}>چلو</Text>
      </View>
      {!compact && <Text style={[styles.logoText, { color: colors.charcoal }]}>Chalo</Text>}
    </View>
  );
}

export function Header({
  title,
  subtitle,
  back,
  onBack,
  action,
  actionIcon = 'ellipsis-horizontal',
  actionLabel = 'More options',
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  action?: () => void;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.header}>
      {back ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          testID="header-back"
          onPress={() => {
            haptics.tap();
            onBack?.();
          }}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressedIcon]}
        >
          <Ionicons name="arrow-back" size={22} color={colors.charcoal} />
        </Pressable>
      ) : (
        <Logo compact />
      )}
      <View style={styles.headerCopy}>
        <Text
          numberOfLines={1}
          accessibilityRole="header"
          style={[styles.headerTitle, { color: colors.charcoal }]}
        >
          {title}
        </Text>
        {subtitle && (
          <Text numberOfLines={1} style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={() => {
            haptics.tap();
            action();
          }}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressedIcon]}
        >
          <Ionicons name={actionIcon} size={22} color={colors.charcoal} />
        </Pressable>
      ) : (
        <View style={styles.iconButton} />
      )}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const colors = useColors();
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      testID={`button-${label.toLowerCase().replaceAll(' ', '-')}`}
      onPress={() => {
        haptics.press();
        onPress();
      }}
      disabled={inactive}
      style={({ pressed }) => [
        styles.primaryButton,
        {
          backgroundColor: disabled ? colors.muted : colors.primary,
          opacity: pressed ? 0.86 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.primaryForeground} />
      ) : (
        <>
          <Text
            style={[
              styles.primaryText,
              { color: disabled ? colors.mutedForeground : colors.primaryForeground },
            ]}
          >
            {label}
          </Text>
          {icon && (
            <Ionicons
              name={icon}
              size={18}
              color={disabled ? colors.mutedForeground : colors.primaryForeground}
            />
          )}
        </>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  icon,
  tone = 'neutral',
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: 'neutral' | 'danger';
}) {
  const colors = useColors();
  const textColor = tone === 'danger' ? colors.destructive : colors.charcoal;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.secondaryButton,
        {
          backgroundColor: colors.card,
          borderColor: tone === 'danger' ? colors.destructive : colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text style={[styles.secondaryText, { color: textColor }]}>{label}</Text>
      {icon && <Ionicons name={icon} size={17} color={textColor} />}
    </Pressable>
  );
}

export function Pill({
  label,
  active = false,
  onPress,
  tone = 'neutral',
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  tone?: 'neutral' | 'green' | 'orange';
}) {
  const colors = useColors();
  const bg = active
    ? colors.charcoal
    : tone === 'green'
      ? colors.greenSoft
      : tone === 'orange'
        ? colors.accent
        : colors.card;
  const fg = active
    ? colors.background
    : tone === 'green'
      ? colors.green
      : tone === 'orange'
        ? colors.accentForeground
        : colors.mutedForeground;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={label}
      accessibilityState={onPress ? { selected: active } : undefined}
      onPress={
        onPress
          ? () => {
              haptics.selection();
              onPress();
            }
          : undefined
      }
      disabled={!onPress}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: bg,
          borderColor: active ? colors.charcoal : colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** Tab-style selector used by Trips and the search sort row. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  label?: string;
}) {
  const colors = useColors();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={[styles.segmented, { backgroundColor: colors.secondary }]}
    >
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="tab"
            accessibilityLabel={option}
            accessibilityState={{ selected: active }}
            onPress={() => {
              haptics.selection();
              onChange(option);
            }}
            style={({ pressed }) => [
              styles.segment,
              active && { backgroundColor: colors.charcoal },
              { opacity: pressed && !active ? 0.6 : 1 },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.segmentText,
                { color: active ? colors.background : colors.mutedForeground },
              ]}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Avatar({
  initials,
  size = 42,
  accent = false,
}: {
  initials: string;
  size?: number;
  accent?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      accessible
      accessibilityLabel={`Avatar for ${initials}`}
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: accent ? colors.accent : colors.secondary,
        },
      ]}
    >
      <Text
        style={[
          styles.avatarText,
          { color: accent ? colors.accentForeground : colors.charcoal, fontSize: size / 2.65 },
        ]}
      >
        {initials}
      </Text>
    </View>
  );
}

export function Rating({ value }: { value: number }) {
  const colors = useColors();
  return (
    <View accessible accessibilityLabel={`Rated ${value.toFixed(1)} out of 5`} style={styles.rating}>
      <Ionicons name="star" size={14} color={colors.primary} />
      <Text style={[styles.ratingText, { color: colors.charcoal }]}>{value.toFixed(1)}</Text>
    </View>
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeader}>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.charcoal }]}>
        {title}
      </Text>
      {action && onAction && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${action}: ${title}`}
          onPress={() => {
            haptics.tap();
            onAction();
          }}
          style={({ pressed }) => [styles.sectionActionHit, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.sectionAction, { color: colors.primary }]}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function RouteVisual({ compact = false }: { from?: string; to?: string; compact?: boolean }) {
  const colors = useColors();
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.routeVisual, compact && { paddingVertical: 4 }]}
    >
      <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
      <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
      <View style={[styles.routeDot, { backgroundColor: colors.green }]} />
    </View>
  );
}

export function RideCard({ ride, onPress }: { ride: Ride; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${ride.from} to ${ride.to}, departing ${ride.departure}, ${ride.duration}, Rs ${ride.price} per seat, driver ${ride.driver.name}, ${ride.seatsLeft} seats left`}
      testID={`ride-card-${ride.id}`}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.rideCard,
        {
          backgroundColor: colors.card,
          borderColor: ride.recommended ? colors.primary : colors.border,
          opacity: pressed ? 0.94 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      {ride.recommended && (
        <View style={[styles.matchBadge, { backgroundColor: colors.accent }]}>
          <Ionicons name="sparkles" size={13} color={colors.accentForeground} />
          <Text style={[styles.matchText, { color: colors.accentForeground }]}>Best match</Text>
        </View>
      )}
      <View style={styles.rideTop}>
        <View>
          <Text style={[styles.time, { color: colors.charcoal }]}>{ride.departure}</Text>
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>{ride.duration}</Text>
        </View>
        <View style={styles.arrowWrap}>
          <View style={[styles.arrowLine, { backgroundColor: colors.border }]} />
          <Ionicons name="arrow-forward" size={16} color={colors.mutedForeground} />
          <View style={[styles.arrowLine, { backgroundColor: colors.border }]} />
        </View>
        <View style={styles.alignRight}>
          <Text style={[styles.time, { color: colors.charcoal }]}>{ride.arrival}</Text>
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>arrive</Text>
        </View>
      </View>
      <View style={[styles.rideDivider, { backgroundColor: colors.border }]} />
      <View style={styles.rideRoute}>
        <View style={styles.rideRouteCopy}>
          <Text style={[styles.strongSmall, { color: colors.charcoal }]}>
            {ride.from} → {ride.to}
          </Text>
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>
            {ride.pickupDistance} pickup · {ride.dropoffDistance} destination
          </Text>
        </View>
        <View style={styles.alignRight}>
          <Text style={[styles.price, { color: colors.charcoal }]}>
            Rs. {ride.price.toLocaleString()}
          </Text>
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>per seat</Text>
        </View>
      </View>
      <View style={styles.driverLine}>
        <Avatar initials={ride.driver.initials} size={27} />
        <Text style={[styles.driverName, { color: colors.charcoal }]}>{ride.driver.name}</Text>
        <Rating value={ride.driver.rating} />
        <View style={styles.driverSpacer} />
        <Pill
          label={`${ride.seatsLeft} seat${ride.seatsLeft === 1 ? '' : 's'} left`}
          tone={ride.seatsLeft <= 1 ? 'orange' : 'green'}
        />
      </View>
    </Pressable>
  );
}

export function InfoBanner({
  icon,
  text,
  tone = 'neutral',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  tone?: 'neutral' | 'green' | 'warning';
}) {
  const colors = useColors();
  const background =
    tone === 'green' ? colors.greenSoft : tone === 'warning' ? colors.cream : colors.accent;
  const iconColor =
    tone === 'green' ? colors.green : tone === 'warning' ? colors.routeOrangeMarker : colors.primary;
  return (
    <View style={[styles.banner, { backgroundColor: background }]}>
      <Ionicons name={icon} size={17} color={iconColor} />
      <Text style={[styles.bannerText, { color: colors.charcoal }]}>{text}</Text>
    </View>
  );
}

/** Shimmerless placeholder — enough to hold layout while data lands. */
export function Skeleton({
  height = 16,
  width = '100%',
  radius = 8,
  style,
}: {
  height?: number;
  width?: number | string;
  radius?: number;
  style?: object;
}) {
  const colors = useColors();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { height, width: width as number, borderRadius: radius, backgroundColor: colors.muted, opacity: 0.55 },
        style,
      ]}
    />
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.accent }]}>
        <Ionicons name={icon} size={26} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.charcoal }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>{body}</Text>
      {action && onAction && <SecondaryButton label={action} onPress={onAction} />}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1 },
  screenOuter: { flex: 1, alignItems: 'center' },
  screen: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 56, marginBottom: 12, gap: 12 },
  headerCopy: { flex: 1 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 21, letterSpacing: -0.4 },
  headerSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 3 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoMark: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
  },
  logoUrdu: { fontSize: 19, fontWeight: '700', transform: [{ rotate: '6deg' }] },
  logoText: { fontFamily: 'Inter_700Bold', fontSize: 20, letterSpacing: -0.8 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pressedIcon: { opacity: 0.55 },
  primaryButton: {
    minHeight: 54,
    borderRadius: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 18,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  pill: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 7 },
  pillText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  segmented: { flexDirection: 'row', borderRadius: 14, padding: 4, marginBottom: 19 },
  segment: { flex: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  segmentText: { fontFamily: 'Inter_600SemiBold', fontSize: 10.5 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Inter_700Bold' },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.2 },
  sectionActionHit: { paddingVertical: 8, paddingLeft: 12 },
  sectionAction: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  routeVisual: { width: 36, alignItems: 'center', paddingVertical: 12, marginRight: 10 },
  routeDot: { width: 10, height: 10, borderRadius: 5 },
  routeLine: { width: 2, height: 27 },
  rideCard: { borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 12 },
  matchBadge: {
    alignSelf: 'flex-start',
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  matchText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  rideTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  time: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  muted: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3 },
  arrowWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  arrowLine: { flex: 1, height: 1 },
  alignRight: { alignItems: 'flex-end' },
  price: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  rideDivider: { height: 1, marginVertical: 15 },
  rideRoute: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  rideRouteCopy: { flex: 1 },
  strongSmall: { fontFamily: 'Inter_600SemiBold', fontSize: 12.5 },
  driverLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 15 },
  driverName: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  driverSpacer: { flex: 1 },
  banner: {
    borderRadius: 15,
    padding: 13,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  bannerText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 11.5, lineHeight: 17 },
  empty: { alignItems: 'center', paddingVertical: 55, paddingHorizontal: 22 },
  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 19, textAlign: 'center' },
  emptyBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
});
