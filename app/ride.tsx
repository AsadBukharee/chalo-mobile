import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, Header, Pill, PrimaryButton, Rating, RouteVisual, Screen } from '@/components/ChaloUI';
import { RideMapPreview } from '@/components/RideMap';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

export default function RideScreen() {
  const colors = useColors();
  const { selectedRide: ride } = useApp();
  return <Screen>
    <Header title="Ride details" subtitle="Review before booking" back onBack={() => router.back()} />
    <View style={[styles.routeCard, { backgroundColor: colors.inverseSurface }]}>
      <View style={styles.routeTimes}>
        <View><Text style={[styles.time, { color: colors.inverseForeground }]}>{ride.departure}</Text><Text style={[styles.routePlace, { color: colors.inverseMuted }]}>{ride.from}</Text></View>
        <View style={styles.routeArrow}><View style={[styles.line, { backgroundColor: colors.primary }]} /><Ionicons name="arrow-forward" size={18} color={colors.primary} /></View>
        <View style={styles.alignRight}><Text style={[styles.time, { color: colors.inverseForeground }]}>{ride.arrival}</Text><Text style={[styles.routePlace, { color: colors.inverseMuted }]}>{ride.to}</Text></View>
      </View>
      <View style={styles.journeyTag}><Ionicons name="time-outline" size={14} color={colors.primary} /><Text style={[styles.tagText, { color: colors.inverseForeground }]}>{ride.duration} journey</Text></View>
    </View>
    <RideMapPreview ride={ride} />
    <View style={[styles.pickupRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <RouteVisual from={ride.pickup} to={ride.dropoff} />
      <View style={styles.pickupCopy}><Text style={[styles.pickupLabel, { color: colors.mutedForeground }]}>PICKUP & DROP-OFF</Text><Text style={[styles.pickupPlace, { color: colors.charcoal }]}>{ride.pickup}</Text><Text style={[styles.pickupPlace, { color: colors.charcoal }]}>{ride.dropoff}</Text></View>
    </View>
    <Text style={[styles.section, { color: colors.charcoal }]}>Your driver</Text>
    <Pressable onPress={() => router.push('/driver')} style={[styles.driverCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Avatar initials={ride.driver.initials} size={52} accent />
      <View style={styles.driverCopy}><Text style={[styles.driverTitle, { color: colors.charcoal }]}>{ride.driver.name}</Text><View style={styles.ratingLine}><Rating value={ride.driver.rating} /><Text style={[styles.muted, { color: colors.mutedForeground }]}>{ride.driver.trips} trips</Text></View><View style={styles.verified}><Ionicons name="shield-checkmark" size={13} color={colors.green} /><Text style={[styles.verifiedText, { color: colors.green }]}>Verified driver</Text></View></View>
      <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
    </Pressable>
    <Text style={[styles.section, { color: colors.charcoal }]}>Vehicle</Text>
    <Pressable onPress={() => router.push('/vehicle')} style={[styles.vehicleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.vehicleIcon, { backgroundColor: colors.secondary }]}><Ionicons name="car-sport-outline" size={26} color={colors.charcoal} /></View>
      <View style={styles.driverCopy}><Text style={[styles.driverTitle, { color: colors.charcoal }]}>{ride.vehicle.make} {ride.vehicle.model}</Text><Text style={[styles.muted, { color: colors.mutedForeground }]}>{ride.vehicle.year} · {ride.vehicle.color} · {ride.vehicle.seats} seats</Text></View>
      <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
    </Pressable>
    <View style={styles.fareRow}><View><Text style={[styles.muted, { color: colors.mutedForeground }]}>PRICE PER SEAT</Text><Text style={[styles.fare, { color: colors.charcoal }]}>Rs. {ride.price.toLocaleString()}</Text></View><Pill label={`${ride.seatsLeft} seats left`} tone="green" /></View>
    <PrimaryButton label="Choose your seat" icon="arrow-forward" onPress={() => router.push('/booking')} />
    <View style={styles.policy}><Ionicons name="information-circle-outline" size={15} color={colors.mutedForeground} /><Text style={[styles.policyText, { color: colors.mutedForeground }]}>Free cancellation up to 2 hours before departure.</Text></View>
  </Screen>;
}

const styles = StyleSheet.create({
  routeCard: { borderRadius: 22, padding: 18, marginBottom: 14 },
  routeTimes: { flexDirection: 'row', alignItems: 'center' },
  time: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  routePlace: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },
  routeArrow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  line: { width: 34, height: 2 },
  alignRight: { alignItems: 'flex-end' },
  journeyTag: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 17 },
  tagText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  pickupRow: { borderRadius: 18, borderWidth: 1, padding: 13, flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  pickupCopy: { flex: 1 },
  pickupLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.8, marginBottom: 8 },
  pickupPlace: { fontFamily: 'Inter_500Medium', fontSize: 11, marginBottom: 11 },
  section: { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 10 },
  driverCard: { borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 20 },
  driverCopy: { flex: 1 },
  driverTitle: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  ratingLine: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 5 },
  muted: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3 },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  verifiedText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  vehicleCard: { borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 23 },
  vehicleIcon: { width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  fareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  fare: { fontFamily: 'Inter_700Bold', fontSize: 23, marginTop: 3 },
  policy: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 13, marginBottom: 10 },
  policyText: { fontFamily: 'Inter_400Regular', fontSize: 10 },
});