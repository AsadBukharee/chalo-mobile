import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { EmptyState, Header, Pill, RideCard, Screen, Segmented } from '@/components/ChaloUI';
import * as haptics from '@/components/haptics';
import { type Ride } from '@/data/mock';
import { useRideSearch } from '@/hooks/useRideData';
import { toApiDate } from '@/lib/adapters';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const sorts = ['Best match', 'Cheapest', 'Earliest'] as const;
type Sort = (typeof sorts)[number];

/** "08:30 AM" → minutes since midnight, so times sort correctly. */
function toMinutes(time: string) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time.trim());
  if (!match) return 0;
  let hours = Number(match[1]) % 12;
  if (match[3]!.toUpperCase() === 'PM') hours += 12;
  return hours * 60 + Number(match[2]);
}

export default function SearchScreen() {
  const colors = useColors();
  const { from, to, date, passengers, selectRide } = useApp();
  const [sort, setSort] = useState<Sort>('Best match');
  const [showFilters, setShowFilters] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [morningOnly, setMorningOnly] = useState(false);
  const [enoughSeats, setEnoughSeats] = useState(false);

  // The API does the route and date filtering; price, time and seat filters
  // stay client-side because they are cheap and instant to toggle.
  const {
    rides,
    isLoading,
    error,
    refetch,
    unconfigured,
  } = useRideSearch({
    origin: from,
    destination: to,
    date: toApiDate(new Date()),
    seats: passengers,
  });

  const priceCaps = useMemo(() => {
    if (!rides.length) return [] as number[];
    const prices = rides.map((ride) => ride.price).sort((a, b) => a - b);
    return [prices[0]!, prices[Math.floor(prices.length / 2)]!, prices[prices.length - 1]!];
  }, [rides]);

  const results = useMemo(() => {
    // No client-side route fallback any more: the server already answered the
    // question that was asked, and padding an empty result with rides on other
    // routes would offer seats nobody can actually book.
    const filtered = rides.filter((ride: Ride) => {
      if (maxPrice !== null && ride.price > maxPrice) return false;
      if (morningOnly && toMinutes(ride.departure) >= 12 * 60) return false;
      if (enoughSeats && ride.seatsLeft < passengers) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sort === 'Cheapest') return a.price - b.price;
      if (sort === 'Earliest') return toMinutes(a.departure) - toMinutes(b.departure);
      // Best match: recommended first, then rating, then price.
      if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
      if (a.driver.rating !== b.driver.rating) return b.driver.rating - a.driver.rating;
      return a.price - b.price;
    });
  }, [rides, sort, maxPrice, morningOnly, enoughSeats, passengers]);

  const activeFilters =
    (maxPrice !== null ? 1 : 0) + (morningOnly ? 1 : 0) + (enoughSeats ? 1 : 0);

  const clearFilters = () => {
    haptics.tap();
    setMaxPrice(null);
    setMorningOnly(false);
    setEnoughSeats(false);
  };


  return (
    <Screen>
      <Header
        title={`${from} → ${to}`}
        subtitle={
          isLoading ? `${date} · searching…` : `${date} · ${results.length} ride${results.length === 1 ? '' : 's'} found`
        }
        back
        onBack={() => router.back()}
        action={() => setShowFilters((value) => !value)}
        actionIcon="options-outline"
        actionLabel="Toggle filters"
      />

      <View style={styles.topLine}>
        <Text style={[styles.resultTitle, { color: colors.charcoal }]}>Available rides</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showFilters ? 'Hide filters' : 'Show filters'}
          accessibilityState={{ expanded: showFilters }}
          testID="search-filters"
          onPress={() => {
            haptics.tap();
            setShowFilters((value) => !value);
          }}
          style={({ pressed }) => [
            styles.filterButton,
            {
              backgroundColor: activeFilters ? colors.charcoal : colors.card,
              borderColor: activeFilters ? colors.charcoal : colors.border,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Ionicons
            name="options-outline"
            size={16}
            color={activeFilters ? colors.background : colors.charcoal}
          />
          <Text
            style={[
              styles.filterText,
              { color: activeFilters ? colors.background : colors.charcoal },
            ]}
          >
            {activeFilters ? `Filters · ${activeFilters}` : 'Filters'}
          </Text>
        </Pressable>
      </View>

      <Segmented options={sorts} value={sort} onChange={setSort} label="Sort rides" />

      {showFilters && (
        <View style={[styles.filterPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.filterHeader}>
            <Text style={[styles.filterHeading, { color: colors.charcoal }]}>Refine results</Text>
            {activeFilters > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear all filters"
                onPress={clearFilters}
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={[styles.clearText, { color: colors.primary }]}>Clear all</Text>
              </Pressable>
            )}
          </View>

          <Text style={[styles.filterLabel, { color: colors.mutedForeground }]}>MAX PRICE PER SEAT</Text>
          <View style={styles.filterRow}>
            <Pill label="Any" active={maxPrice === null} onPress={() => setMaxPrice(null)} />
            {priceCaps.map((cap) => (
              <Pill
                key={cap}
                label={`≤ Rs. ${cap.toLocaleString()}`}
                active={maxPrice === cap}
                onPress={() => setMaxPrice(cap)}
              />
            ))}
          </View>

          <View style={[styles.toggleRow, { borderTopColor: colors.border }]}>
            <View style={styles.toggleCopy}>
              <Text style={[styles.toggleTitle, { color: colors.charcoal }]}>Morning departures</Text>
              <Text style={[styles.toggleBody, { color: colors.mutedForeground }]}>
                Leaving before 12:00 PM
              </Text>
            </View>
            <Switch
              value={morningOnly}
              onValueChange={(value) => {
                haptics.selection();
                setMorningOnly(value);
              }}
              accessibilityLabel="Only show morning departures"
              trackColor={{ true: colors.primary, false: colors.muted }}
              thumbColor={colors.white}
            />
          </View>

          <View style={[styles.toggleRow, { borderTopColor: colors.border }]}>
            <View style={styles.toggleCopy}>
              <Text style={[styles.toggleTitle, { color: colors.charcoal }]}>
                Fits {passengers} passenger{passengers > 1 ? 's' : ''}
              </Text>
              <Text style={[styles.toggleBody, { color: colors.mutedForeground }]}>
                Hide rides without enough seats
              </Text>
            </View>
            <Switch
              value={enoughSeats}
              onValueChange={(value) => {
                haptics.selection();
                setEnoughSeats(value);
              }}
              accessibilityLabel="Only show rides with enough seats"
              trackColor={{ true: colors.primary, false: colors.muted }}
              thumbColor={colors.white}
            />
          </View>
        </View>
      )}

      {isLoading && rides.length === 0 && (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Finding rides from {from} to {to}
          </Text>
        </View>
      )}

      {!isLoading && (error || unconfigured) && (
        <EmptyState
          icon="cloud-offline-outline"
          title={unconfigured ? 'No server configured' : "Couldn't load rides"}
          body={
            unconfigured
              ? 'Set EXPO_PUBLIC_API_BASE_URL and restart Metro with `npx expo start -c`.'
              : (error?.message ?? 'Something went wrong reaching the server.')
          }
          action={unconfigured ? undefined : 'Try again'}
          onAction={unconfigured ? undefined : () => void refetch()}
        />
      )}

      {!isLoading && !error && !unconfigured && results.length === 0 ? (
        <EmptyState
          icon="car-outline"
          title={rides.length === 0 ? 'No rides on this route yet' : 'No rides match those filters'}
          body={
            rides.length === 0
              ? `Nobody is driving ${from} → ${to} on this date. Try another day or route.`
              : 'Try widening your price range or turning off a filter.'
          }
          action={rides.length === 0 ? undefined : 'Clear filters'}
          onAction={rides.length === 0 ? undefined : clearFilters}
        />
      ) : (
        results.map((ride) => (
          <RideCard
            key={ride.id}
            ride={ride}
            onPress={() => {
              selectRide(ride);
              router.push('/ride');
            }}
          />
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: 10, paddingVertical: 44 },
  loadingText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 14,
    gap: 10,
  },
  resultTitle: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  filterButton: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  filterPanel: { borderWidth: 1, borderRadius: 18, padding: 15, marginBottom: 16 },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  filterHeading: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  clearText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  filterLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.9, marginBottom: 9 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 14,
  },
  toggleCopy: { flex: 1 },
  toggleTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  toggleBody: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3 },
  notice: {
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 14,
  },
  noticeText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 11.5, lineHeight: 17 },
});
