import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { popularRoutes, trips } from '@/data/mock';
import { Avatar, Logo, Pill, RouteVisual, Screen, SectionHeader } from '@/components/ChaloUI';
import * as haptics from '@/components/haptics';
import { useColors } from '@/hooks/useColors';

export default function HomeScreen() {
  const colors = useColors();
  const { from, to, date, passengers, booking, selectRide, setFrom, setTo } = useApp();
  const routeColors = [colors.accent, colors.greenSoft, colors.cream];

  /** Prefer a real booking; otherwise show the seeded upcoming trip. */
  const upcoming = useMemo(() => {
    if (booking) {
      return {
        ride: booking.ride,
        when: booking.date,
        seats: booking.seats.length,
        badge: 'BOOKED',
      };
    }
    const seeded = trips.find((trip) => trip.status === 'upcoming');
    return seeded
      ? { ride: seeded.ride, when: seeded.date, seats: seeded.seats.length, badge: 'UP NEXT' }
      : null;
  }, [booking]);

  const openTrip = () => {
    if (!upcoming) return;
    haptics.tap();
    selectRide(upcoming.ride);
    router.push('/journey');
  };

  const search = () => {
    haptics.press();
    router.push('/search');
  };

  return (
    <Screen>
      <View style={styles.topRow}>
        <Logo />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          onPress={() => router.push('/(tabs)/profile')}
          style={({ pressed }) => [
            styles.profileButton,
            { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Avatar initials="AS" size={32} />
        </Pressable>
      </View>

      <View style={[styles.hero, { backgroundColor: colors.primary }]}>
        <View style={styles.heroGlow} />
        <Text style={[styles.heroEyebrow, { color: colors.primaryForeground }]}>
          CHALO · MOVE TOGETHER
        </Text>
        <View style={styles.heroTitleRow}>
          <View style={styles.heroTitleCopy}>
            <Text style={[styles.heroTitle, { color: colors.primaryForeground }]}>
              Where will{'\n'}you go next?
            </Text>
            <Text style={[styles.heroSubtitle, { color: colors.primaryForeground }]}>
              Find a trusted seat in a car headed your way.
            </Text>
          </View>
          <View style={[styles.heroBadge, { backgroundColor: colors.primaryForeground }]}>
            <Ionicons name="navigate" size={20} color={colors.primary} />
            <Text style={[styles.heroBadgeText, { color: colors.primary }]}>LIVE</Text>
          </View>
        </View>

        <View style={[styles.searchPanel, { backgroundColor: colors.card }]}>
          <Text style={[styles.panelEyebrow, { color: colors.mutedForeground }]}>
            PLAN YOUR JOURNEY
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Leaving from ${from}. Change origin`}
            onPress={() => router.push({ pathname: '/location', params: { field: 'from' } })}
            style={({ pressed }) => [styles.locationRow, { opacity: pressed ? 0.65 : 1 }]}
          >
            <View style={[styles.locationIcon, { backgroundColor: colors.accent }]}>
              <Ionicons name="radio-button-on" size={15} color={colors.accentForeground} />
            </View>
            <View style={styles.fieldText}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Leaving from</Text>
              <Text style={[styles.fieldValue, { color: colors.charcoal }]}>{from}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </Pressable>

          <View style={styles.swapRow}>
            <View style={[styles.searchLine, { backgroundColor: colors.border }]} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Swap origin and destination"
              testID="swap-cities"
              onPress={() => {
                haptics.selection();
                const previous = from;
                setFrom(to);
                setTo(previous);
              }}
              style={({ pressed }) => [
                styles.swapButton,
                { backgroundColor: colors.secondary, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons name="swap-vertical" size={15} color={colors.charcoal} />
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Going to ${to}. Change destination`}
            onPress={() => router.push({ pathname: '/location', params: { field: 'to' } })}
            style={({ pressed }) => [styles.locationRow, { opacity: pressed ? 0.65 : 1 }]}
          >
            <View style={[styles.locationIcon, { backgroundColor: colors.greenSoft }]}>
              <Ionicons name="location" size={15} color={colors.green} />
            </View>
            <View style={styles.fieldText}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Going to</Text>
              <Text style={[styles.fieldValue, { color: colors.charcoal }]}>{to}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </Pressable>

          <View style={styles.searchMeta}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Travel date ${date}. Change date`}
              onPress={() => router.push('/travel-options')}
              style={({ pressed }) => [styles.metaItem, { opacity: pressed ? 0.65 : 1 }]}
            >
              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              <Text numberOfLines={1} style={[styles.metaText, { color: colors.charcoal }]}>
                {date}
              </Text>
            </Pressable>
            <View style={[styles.metaDivider, { backgroundColor: colors.border }]} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${passengers} passenger. Change passengers`}
              onPress={() => router.push('/travel-options')}
              style={({ pressed }) => [styles.metaItem, { opacity: pressed ? 0.65 : 1 }]}
            >
              <Ionicons name="people-outline" size={16} color={colors.primary} />
              <Text numberOfLines={1} style={[styles.metaText, { color: colors.charcoal }]}>
                {passengers} passenger{passengers > 1 ? 's' : ''}
              </Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Find rides from ${from} to ${to}`}
            testID="find-rides"
            onPress={search}
            style={({ pressed }) => [
              styles.findButton,
              { backgroundColor: colors.charcoal, opacity: pressed ? 0.86 : 1 },
            ]}
          >
            <Text style={[styles.findButtonText, { color: colors.background }]}>Find rides</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.background} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.trustStrip, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.trustStat}>
          <Text style={[styles.trustNumber, { color: colors.charcoal }]}>4.9</Text>
          <View style={styles.trustLabelRow}>
            <Ionicons name="star" size={12} color={colors.primary} />
            <Text style={[styles.trustLabel, { color: colors.mutedForeground }]}>rider rating</Text>
          </View>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.trustStat}>
          <Text style={[styles.trustNumber, { color: colors.charcoal }]}>10k+</Text>
          <Text style={[styles.trustLabel, { color: colors.mutedForeground }]}>safe journeys</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.trustStat}>
          <Text style={[styles.trustNumber, { color: colors.charcoal }]}>100%</Text>
          <Text style={[styles.trustLabel, { color: colors.mutedForeground }]}>clear pricing</Text>
        </View>
      </View>

      {upcoming && (
        <>
          <SectionHeader
            title="Your next trip"
            action="View all"
            onAction={() => router.push('/(tabs)/trips')}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open your ${upcoming.ride.from} to ${upcoming.ride.to} trip, ${upcoming.when} at ${upcoming.ride.departure}`}
            testID="next-trip"
            onPress={openTrip}
            style={({ pressed }) => [
              styles.nextTrip,
              { backgroundColor: colors.cream, borderColor: colors.border, opacity: pressed ? 0.92 : 1 },
            ]}
          >
            <View style={[styles.ticketNotchTop, { backgroundColor: colors.background }]} />
            <View style={styles.nextTripTop}>
              <View style={styles.ticketCopy}>
                <Text style={[styles.ticketKicker, { color: colors.accentForeground }]}>
                  {upcoming.badge}
                </Text>
                <Pill label={upcoming.when.toUpperCase()} tone="orange" />
              </View>
              <View style={styles.timeBlock}>
                <Text style={[styles.tripTime, { color: colors.charcoal }]}>
                  {upcoming.ride.departure.replace(/\s?(AM|PM)$/i, '')}
                </Text>
                <Text style={[styles.timeZone, { color: colors.mutedForeground }]}>
                  {upcoming.ride.departure.slice(-2)} · {upcoming.seats} SEAT
                  {upcoming.seats > 1 ? 'S' : ''}
                </Text>
              </View>
            </View>
            <View style={[styles.ticketRule, { backgroundColor: colors.border }]} />
            <View style={styles.nextTripRoute}>
              <RouteVisual compact />
              <View style={styles.routeBlock}>
                <Text style={[styles.routeMain, { color: colors.charcoal }]}>
                  {upcoming.ride.from} → {upcoming.ride.to}
                </Text>
                <Text style={[styles.muted, { color: colors.mutedForeground }]}>
                  {upcoming.ride.driver.name} · {upcoming.ride.vehicle.make}{' '}
                  {upcoming.ride.vehicle.model}
                </Text>
              </View>
              <View style={[styles.ticketArrow, { backgroundColor: colors.card }]}>
                <Ionicons name="arrow-forward" size={17} color={colors.charcoal} />
              </View>
            </View>
          </Pressable>
        </>
      )}

      <SectionHeader title="Go somewhere popular" action="See all" onAction={search} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.routeScroll}>
        {popularRoutes.map((route, index) => (
          <Pressable
            key={`${route.from}-${route.to}`}
            accessibilityRole="button"
            accessibilityLabel={`Search rides from ${route.from} to ${route.to}, ${route.price}`}
            onPress={() => {
              haptics.tap();
              setFrom(route.from);
              setTo(route.to);
              router.push('/search');
            }}
            style={({ pressed }) => [
              styles.popularCard,
              {
                backgroundColor: routeColors[index % routeColors.length],
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <View style={styles.routeCardTop}>
              <View style={[styles.routeIcon, { backgroundColor: colors.card }]}>
                <Ionicons name="arrow-up" size={17} color={colors.charcoal} />
              </View>
              <Text style={[styles.routeCount, { color: colors.mutedForeground }]}>
                0{index + 1}
              </Text>
            </View>
            <View>
              <Text style={[styles.popularRoute, { color: colors.charcoal }]}>{route.from}</Text>
              <Text style={[styles.popularRoute, { color: colors.charcoal }]}>→ {route.to}</Text>
            </View>
            <View style={styles.routeCardBottom}>
              <Text style={[styles.popularPrice, { color: colors.mutedForeground }]}>
                {route.price}
              </Text>
              <Ionicons name="arrow-forward-circle" size={22} color={colors.charcoal} />
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Register your car and start earning"
        onPress={() => {
          haptics.tap();
          router.push('/register-car');
        }}
        style={({ pressed }) => [
          styles.driverInvite,
          { backgroundColor: colors.secondary, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <View style={[styles.driverInviteIcon, { backgroundColor: colors.primary }]}>
          <Ionicons name="car-sport-outline" size={19} color={colors.primaryForeground} />
        </View>
        <View style={styles.driverInviteCopy}>
          <Text style={[styles.driverInviteTitle, { color: colors.charcoal }]}>
            Have an empty seat?
          </Text>
          <Text style={[styles.driverInviteBody, { color: colors.mutedForeground }]}>
            Register your car and turn trips into extra income.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={colors.mutedForeground} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { borderRadius: 28, padding: 18, marginBottom: 20, overflow: 'hidden' },
  heroGlow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    right: -72,
    top: -74,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  heroEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, opacity: 0.8 },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 18,
  },
  heroTitleCopy: { flex: 1 },
  heroTitle: { fontFamily: 'Inter_700Bold', fontSize: 31, lineHeight: 34, letterSpacing: -1.3 },
  heroSubtitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
    maxWidth: 240,
    opacity: 0.86,
  },
  heroBadge: {
    width: 45,
    height: 45,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    transform: [{ rotate: '8deg' }],
  },
  heroBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 7, letterSpacing: 0.7 },
  searchPanel: { borderRadius: 20, padding: 14 },
  panelEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.1, marginBottom: 8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46 },
  locationIcon: { width: 27, height: 27, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fieldText: { flex: 1 },
  fieldLabel: { fontFamily: 'Inter_500Medium', fontSize: 10 },
  fieldValue: { fontFamily: 'Inter_700Bold', fontSize: 15, marginTop: 2 },
  swapRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 37, marginVertical: 4 },
  searchLine: { flex: 1, height: 1 },
  swapButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  searchMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 14 },
  metaItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 40 },
  metaText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  metaDivider: { width: 1, height: 22, marginHorizontal: 8 },
  findButton: {
    minHeight: 52,
    borderRadius: 15,
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  findButtonText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  trustStrip: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  trustStat: { flex: 1, alignItems: 'center', gap: 4 },
  trustNumber: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.5 },
  trustLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  trustLabel: { fontFamily: 'Inter_400Regular', fontSize: 9 },
  statDivider: { width: 1, height: 30 },
  nextTrip: { borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 28, overflow: 'hidden' },
  ticketNotchTop: { position: 'absolute', width: 20, height: 20, borderRadius: 10, right: -10, top: 58 },
  nextTripTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  ticketCopy: { flex: 1, alignItems: 'flex-start' },
  ticketKicker: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.1, marginBottom: 7 },
  timeBlock: { alignItems: 'flex-end' },
  tripTime: { fontFamily: 'Inter_700Bold', fontSize: 21, letterSpacing: -0.6 },
  timeZone: { fontFamily: 'Inter_600SemiBold', fontSize: 8, letterSpacing: 0.8, marginTop: 2 },
  ticketRule: { height: 1, marginVertical: 14 },
  nextTripRoute: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  routeBlock: { flex: 1 },
  routeMain: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  muted: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4 },
  ticketArrow: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  routeScroll: { gap: 10, paddingRight: 20, paddingBottom: 25 },
  popularCard: { width: 154, minHeight: 154, borderRadius: 20, padding: 14, justifyContent: 'space-between' },
  routeCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routeIcon: {
    width: 31,
    height: 31,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
  },
  routeCount: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  popularRoute: { fontFamily: 'Inter_700Bold', fontSize: 14, lineHeight: 18 },
  routeCardBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  popularPrice: { fontFamily: 'Inter_500Medium', fontSize: 10 },
  driverInvite: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  driverInviteIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  driverInviteCopy: { flex: 1 },
  driverInviteTitle: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  driverInviteBody: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15, marginTop: 3 },
});
