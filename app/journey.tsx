import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Avatar, Header, PrimaryButton, Screen } from '@/components/ChaloUI';
import { RideMapPreview } from '@/components/RideMap';
import * as haptics from '@/components/haptics';
import { formatClock, formatDistance, formatDuration } from '@/components/maps/geometry';
import { useRideRoute } from '@/components/maps/useRideRoute';
import { rideWaypoints } from '@/components/routeData';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useLiveTrip, type TripStatus } from '@/hooks/useLiveTrip';
import { api } from '@/lib/api';
import { formatE164 } from '@/lib/phone';

/**
 * Live tracking.
 *
 * The question this screen exists to answer is "where is my car and when will
 * it get here", so that is what it leads with: one number, large, changing as
 * the vehicle moves. The driver, the plate and the safety tools sit below it.
 *
 * It is built to be honest when it does not know. A tracking screen that keeps
 * animating a car forward on a four-minute-old fix is worse than one that says
 * "4m ago", because a rider standing at a pickup point makes decisions from
 * it. The states are explicit and distinct: waiting for the driver to start
 * sharing, live, gone quiet, and reporting from somewhere that is not this
 * route at all.
 */

/** Alert isn't available on web, so fall back to the browser's own dialog. */
function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

const STATUS_COPY: Record<TripStatus, { label: string; detail: string }> = {
  idle: { label: 'NOT TRACKING', detail: 'This trip is not being tracked.' },
  waiting: {
    label: 'WAITING FOR DRIVER',
    detail: 'Tracking begins when your driver starts the trip and shares their position.',
  },
  live: { label: 'LIVE', detail: 'Following your vehicle now.' },
  stale: {
    label: 'SIGNAL LOST',
    detail: 'No new position for a while — usually poor coverage on the motorway.',
  },
  'off-route': {
    label: 'OFF ROUTE',
    detail: 'The vehicle is reporting from away from the planned road.',
  },
};

export default function JourneyScreen() {
  const colors = useColors();
  const { selectedRide, booking } = useApp();
  const trip = booking?.ride ?? selectedRide;
  const apiId = trip.apiId ?? null;

  const [completed, setCompleted] = useState(false);

  // The route is shared with the map below through a module-level cache and an
  // in-flight guard, so asking for it here costs no extra Routes requests.
  const waypoints = useMemo(() => rideWaypoints(trip), [trip]);
  const { route, status: routeStatus } = useRideRoute(trip.id, waypoints, { refreshMs: 120000 });

  const live = useLiveTrip(route, apiId, !completed);

  const [contact, setContact] = useState<{
    name: string;
    phone: string;
    vehicle: string;
    plate: string;
  } | null>(null);

  // The driver's number is not in the ride payload, and the API releases it
  // only to someone with a live booking. A refusal here just means no call
  // button — it is not worth an error message.
  useEffect(() => {
    if (!apiId) return;
    const controller = new AbortController();
    api
      .rideContact(apiId, controller.signal)
      .then(setContact)
      .catch(() => setContact(null));
    return () => controller.abort();
  }, [apiId]);

  const call = useCallback(() => {
    haptics.press();
    const number = contact?.phone;
    if (!number) {
      notify('Number unavailable', `We don't have a contact number for ${trip.driver.name} yet.`);
      return;
    }
    Linking.openURL(`tel:${number}`).catch(() =>
      notify(
        'Call unavailable',
        `This device can't place calls. The number is ${formatE164(number)}.`,
      ),
    );
  }, [contact, trip.driver.name]);

  const shareTrip = useCallback(async () => {
    haptics.tap();
    const eta = live.arrivalAt ? `, arriving around ${formatClock(live.arrivalAt)}` : '';
    try {
      await Share.share({
        message:
          `I'm on a Chalo ride from ${trip.from} to ${trip.to} with ${trip.driver.name} ` +
          `(${trip.vehicle.make} ${trip.vehicle.model}, ${trip.vehicle.plate})${eta}.`,
      });
    } catch {
      // The share sheet was dismissed. Nothing to report.
    }
  }, [live.arrivalAt, trip]);

  const safety = useCallback(() => {
    haptics.warning();
    notify(
      'Safety centre',
      'Share your live trip, call emergency services, or report an issue with this journey.',
    );
  }, []);

  const tone =
    live.status === 'live'
      ? colors.green
      : live.status === 'waiting'
        ? colors.primary
        : colors.routeYellow;

  const status = STATUS_COPY[completed ? 'idle' : live.status];

  const headline = () => {
    if (completed) return `Arrived in ${trip.to}`;
    if (live.status === 'waiting') return 'Waiting to set off';
    if (live.etaSeconds === null) return 'On the way';
    return formatDuration(live.etaSeconds);
  };

  const subhead = () => {
    if (completed) return 'Thanks for riding with Chalo';
    if (live.status === 'waiting') return `Pickup at ${trip.pickup}`;
    if (live.arrivalAt) return `Arriving around ${formatClock(live.arrivalAt)}`;
    return `Heading to ${trip.to}`;
  };

  return (
    <Screen>
      <Header
        title="Live tracking"
        subtitle={`${trip.from} → ${trip.to}`}
        back
        onBack={() => router.back()}
        action={safety}
        actionIcon="shield-checkmark-outline"
        actionLabel="Open the safety centre"
      />

      <View
        style={[styles.hero, { backgroundColor: completed ? colors.green : colors.inverseSurface }]}
      >
        <View style={styles.heroTop}>
          <View style={[styles.statusPill, { backgroundColor: `${tone}22`, borderColor: tone }]}>
            {live.status === 'live' && !completed ? (
              <View style={[styles.pulse, { backgroundColor: tone }]} />
            ) : (
              <Ionicons
                name={
                  completed
                    ? 'checkmark-circle'
                    : live.status === 'waiting'
                      ? 'time-outline'
                      : 'warning-outline'
                }
                size={12}
                color={tone}
              />
            )}
            <Text style={[styles.statusPillText, { color: tone }]}>{status.label}</Text>
          </View>
          {live.ageSeconds !== null && live.status !== 'live' && !completed && (
            <Text style={[styles.age, { color: colors.inverseMuted }]}>
              {formatDuration(live.ageSeconds)} ago
            </Text>
          )}
        </View>

        <Text
          accessibilityLiveRegion="polite"
          style={[styles.eta, { color: colors.inverseForeground }]}
        >
          {headline()}
        </Text>
        <Text style={[styles.etaSub, { color: colors.inverseMuted }]}>{subhead()}</Text>

        {/* Progress measured along the actual road, not a two-tone placeholder. */}
        <View style={[styles.track, { backgroundColor: colors.inverseMuted }]}>
          <View
            style={[
              styles.trackFill,
              {
                backgroundColor: completed ? colors.inverseForeground : colors.primary,
                width: `${Math.round((completed ? 1 : live.progress) * 100)}%`,
              },
            ]}
          />
          {!completed && live.progress > 0 && (
            <View
              style={[
                styles.trackDot,
                { left: `${Math.round(live.progress * 100)}%`, backgroundColor: colors.primary },
              ]}
            />
          )}
        </View>

        <View style={styles.trackLabels}>
          <Text style={[styles.trackLabel, { color: colors.inverseForeground }]}>{trip.from}</Text>
          <Text style={[styles.trackLabel, { color: colors.inverseForeground }]}>{trip.to}</Text>
        </View>

        <View style={[styles.metrics, { borderTopColor: colors.inverseMuted }]}>
          <Metric label="TRAVELLED" value={formatDistance(live.travelledMeters)} colors={colors} />
          <Metric label="REMAINING" value={formatDistance(live.remainingMeters)} colors={colors} />
          <Metric
            label="SPEED"
            value={live.speedKph === null ? '—' : `${live.speedKph} km/h`}
            colors={colors}
          />
        </View>
      </View>

      <RideMapPreview
        ride={trip}
        mode="journey"
        rideApiId={apiId}
        // This screen owns the poller. Passing the position stops the map
        // opening a second one against the same endpoint, which would double
        // the requests and leave two markers seconds out of step.
        vehicle={
          live.position
            ? {
                latitude: live.position.latitude,
                longitude: live.position.longitude,
                heading: live.heading,
              }
            : null
        }
      />

      {routeStatus === 'loading' && (
        <View style={[styles.notice, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.noticeText, { color: colors.mutedForeground }]}>
            Loading the road route…
          </Text>
        </View>
      )}

      {!completed && live.status !== 'live' && (
        <View
          style={[styles.notice, { backgroundColor: colors.accent, borderColor: colors.accent }]}
        >
          <Ionicons
            name={live.status === 'waiting' ? 'navigate-outline' : 'cellular-outline'}
            size={16}
            color={colors.primary}
          />
          <Text style={[styles.noticeText, { color: colors.charcoal }]}>
            {status.detail}
            {live.status === 'off-route' && live.offRouteMeters
              ? ` It is ${formatDistance(live.offRouteMeters)} from the planned route.`
              : ''}
          </Text>
        </View>
      )}

      {live.error && (
        <View
          style={[styles.notice, { backgroundColor: colors.accent, borderColor: colors.accent }]}
        >
          <Ionicons name="alert-circle-outline" size={16} color={colors.primary} />
          <Text style={[styles.noticeText, { color: colors.charcoal }]}>{live.error}</Text>
        </View>
      )}

      <Text style={[styles.section, { color: colors.charcoal }]}>Your driver</Text>
      <View
        style={[styles.driverCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Avatar initials={trip.driver.initials} size={46} accent />
        <View style={styles.driverCopy}>
          <Text style={[styles.driverName, { color: colors.charcoal }]}>
            {contact?.name || trip.driver.name}
          </Text>
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>
            {contact?.vehicle || `${trip.vehicle.make} ${trip.vehicle.model}`} ·{' '}
            {contact?.plate || trip.vehicle.plate}
          </Text>
          {contact?.phone ? (
            <Text style={[styles.muted, { color: colors.mutedForeground }]}>
              {formatE164(contact.phone)}
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Call ${contact?.name || trip.driver.name}`}
          accessibilityState={{ disabled: !contact?.phone }}
          onPress={call}
          style={({ pressed }) => [
            styles.call,
            {
              backgroundColor: contact?.phone ? colors.greenSoft : colors.muted,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Ionicons
            name="call"
            size={18}
            color={contact?.phone ? colors.green : colors.mutedForeground}
          />
        </Pressable>
      </View>

      <View style={styles.quickActions}>
        <Quick
          icon="share-outline"
          label="Share trip"
          onPress={() => void shareTrip()}
          colors={colors}
          tint={colors.charcoal}
        />
        <Quick
          icon="shield-checkmark-outline"
          label="Safety"
          onPress={safety}
          colors={colors}
          tint={colors.green}
        />
      </View>

      {!completed && (
        <PrimaryButton
          label="Mark journey complete"
          icon="checkmark"
          onPress={() => {
            haptics.success();
            setCompleted(true);
          }}
        />
      )}
    </Screen>
  );
}

function Metric({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricLabel, { color: colors.inverseMuted }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: colors.inverseForeground }]}>{value}</Text>
    </View>
  );
}

function Quick({
  icon,
  label,
  onPress,
  colors,
  tint,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  tint: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.quick,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <Ionicons name={icon} size={19} color={tint} />
      <Text style={[styles.quickText, { color: colors.charcoal }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 23, padding: 19, marginBottom: 16 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillText: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.9 },
  pulse: { width: 7, height: 7, borderRadius: 4 },
  age: { fontFamily: 'Inter_500Medium', fontSize: 10.5 },
  eta: { fontFamily: 'Inter_700Bold', fontSize: 40, letterSpacing: -1.2, marginTop: 18 },
  etaSub: { fontFamily: 'Inter_500Medium', fontSize: 12.5, marginTop: 4 },
  track: { height: 6, borderRadius: 3, marginTop: 22 },
  trackFill: { height: 6, borderRadius: 3 },
  trackDot: {
    position: 'absolute',
    top: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
  },
  trackLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 9 },
  trackLabel: { fontFamily: 'Inter_500Medium', fontSize: 10 },
  metrics: { flexDirection: 'row', borderTopWidth: 1, marginTop: 18, paddingTop: 15, gap: 10 },
  metric: { flex: 1 },
  metricLabel: { fontFamily: 'Inter_700Bold', fontSize: 8.5, letterSpacing: 0.8 },
  metricValue: { fontFamily: 'Inter_700Bold', fontSize: 15, marginTop: 5 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderRadius: 15,
    padding: 13,
    marginBottom: 14,
  },
  noticeText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 11.5, lineHeight: 17 },
  section: { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 10, marginTop: 8 },
  driverCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  driverCopy: { flex: 1 },
  driverName: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  muted: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4 },
  call: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  quickActions: { flexDirection: 'row', gap: 10, marginVertical: 13 },
  quick: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 15,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 5,
  },
  quickText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
});
