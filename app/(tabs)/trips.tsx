import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { EmptyState, Header, Pill, RouteVisual, Screen, Segmented } from '@/components/ChaloUI';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useMyBookings } from '@/hooks/useRideData';
import { toRide } from '@/lib/adapters';
import type { ApiBooking } from '@/lib/api';
import type { Ride, Trip } from '@/data/mock';

const tabs = ['Upcoming', 'Active', 'Completed', 'Cancelled'] as const;
type Tab = (typeof tabs)[number];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "12 Sep 2026", the format the trip cards already read in. */
function tripDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Which tab a booking belongs under.
 *
 * The booking's own status answers three of the four; "upcoming" versus
 * "active" is a question about the ride, not the booking, so it comes from the
 * ride's status and departure time. A confirmed booking on a bus that left an
 * hour ago is not something a rider thinks of as upcoming.
 */
function statusFor(booking: ApiBooking): Trip['status'] {
  if (booking.status === 'cancelled') return 'cancelled';
  if (booking.status === 'completed') return 'completed';
  const ride = booking.ride;
  if (ride.status === 'active') return 'active';
  if (ride.status === 'completed') return 'completed';
  if (ride.status === 'cancelled') return 'cancelled';
  return new Date(ride.departs_at).getTime() < Date.now() ? 'completed' : 'upcoming';
}

function toTrip(booking: ApiBooking): Trip & { ride: Ride } {
  return {
    id: String(booking.id),
    status: statusFor(booking),
    ride: toRide(booking.ride),
    date: tripDate(booking.ride.departs_at),
    seats: booking.seats ?? [],
    reference: booking.reference,
  };
}

export default function TripsScreen() {
  const colors = useColors();
  const { selectRide } = useApp();
  const [active, setActive] = useState<Tab>('Upcoming');
  const { bookings, isLoading, isRefetching, error, refetch, unconfigured } = useMyBookings();

  const trips = useMemo(() => bookings.map(toTrip), [bookings]);

  const statusByTab = {
    Upcoming: 'upcoming',
    Active: 'active',
    Completed: 'completed',
    Cancelled: 'cancelled',
  } as const;
  const filtered = trips.filter((trip) => trip.status === statusByTab[active]);

  const open = (trip: Trip) => {
    selectRide(trip.ride);
    router.push(trip.status === 'active' ? '/journey' : '/ride');
  };

  return (
    <Screen refreshing={isRefetching} onRefresh={() => void refetch()}>
      <Header
        title="My trips"
        subtitle="Every journey, all in one place"
        action={() => router.push('/travel-options')}
        actionIcon="calendar-outline"
        actionLabel="Change travel dates"
      />
      <Segmented options={tabs} value={active} onChange={setActive} label="Filter trips by status" />

      {isLoading && (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Loading your bookings…
          </Text>
        </View>
      )}

      {!isLoading && (error || unconfigured) && (
        <EmptyState
          icon="cloud-offline-outline"
          title={unconfigured ? 'No server configured' : "Couldn't load your trips"}
          body={
            unconfigured
              ? 'Set EXPO_PUBLIC_API_BASE_URL and restart Metro with `npx expo start -c`.'
              : (error?.message ?? 'Something went wrong reaching the server.')
          }
          action={unconfigured ? undefined : 'Try again'}
          onAction={unconfigured ? undefined : () => void refetch()}
        />
      )}

      {!isLoading &&
        !error &&
        !unconfigured &&
        (filtered.length ? (
          filtered.map((trip) => (
            <Pressable
              key={trip.id}
              onPress={() => open(trip)}
              style={[styles.tripCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={styles.tripTop}>
                <Pill
                  label={trip.status.toUpperCase()}
                  tone={
                    trip.status === 'cancelled'
                      ? 'neutral'
                      : trip.status === 'active'
                        ? 'green'
                        : 'orange'
                  }
                />
                <Text style={[styles.tripDate, { color: colors.mutedForeground }]}>
                  {trip.date} · {trip.ride.departure}
                </Text>
              </View>
              <View style={styles.routeRow}>
                <RouteVisual from={trip.ride.from} to={trip.ride.to} compact />
                <View style={styles.routeCopy}>
                  <Text style={[styles.route, { color: colors.charcoal }]}>
                    {trip.ride.from} → {trip.ride.to}
                  </Text>
                  <Text style={[styles.muted, { color: colors.mutedForeground }]}>
                    {trip.ride.driver.name} · {trip.seats.length} seat
                    {trip.seats.length === 1 ? '' : 's'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </View>
              <View style={styles.tripActions}>
                <Text style={[styles.reference, { color: colors.mutedForeground }]}>
                  {trip.reference ? `Booking ${trip.reference}` : 'Route details'}
                </Text>
                <Pressable
                  accessibilityLabel={`Open map for ${trip.ride.from} to ${trip.ride.to}`}
                  testID={`trip-map-${trip.id}`}
                  onPress={() => {
                    selectRide(trip.ride);
                    router.push({
                      pathname: '/map',
                      params: {
                        ride: trip.ride.id,
                        mode: trip.status === 'active' ? 'journey' : 'route',
                      },
                    });
                  }}
                  style={[styles.mapAction, { backgroundColor: colors.secondary }]}
                >
                  <Ionicons name="map-outline" size={14} color={colors.charcoal} />
                  <Text style={[styles.mapActionText, { color: colors.charcoal }]}>Map</Text>
                </Pressable>
              </View>
            </Pressable>
          ))
        ) : (
          <EmptyState
            icon="briefcase-outline"
            title={
              active === 'Upcoming' ? 'Your next journey starts here' : `No ${active.toLowerCase()} trips`
            }
            body={
              active === 'Upcoming'
                ? 'Find a comfortable seat and start exploring.'
                : 'Your trip history will appear here.'
            }
            action="Find a ride"
            onAction={() => router.push('/search')}
          />
        ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: 10, paddingVertical: 44 },
  loadingText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  tripCard: { borderWidth: 1, borderRadius: 19, padding: 15, marginBottom: 12 },
  tripTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  tripDate: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  routeCopy: { flex: 1 },
  route: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  muted: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4 },
  tripActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  reference: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  mapAction: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  mapActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
});
