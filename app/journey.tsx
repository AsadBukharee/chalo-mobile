import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, Header, Pill, PrimaryButton, Screen } from '@/components/ChaloUI';
import { RideMapPreview } from '@/components/RideMap';
import * as haptics from '@/components/haptics';
import { trips } from '@/data/mock';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

/** Alert isn't available on web, so fall back to the browser's own dialog. */
function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

export default function JourneyScreen() {
  const colors = useColors();
  const { selectedRide: ride, booking } = useApp();
  const [completed, setCompleted] = useState(false);
  const trip = booking?.ride ?? ride ?? trips[1]!.ride;

  const call = () => {
    haptics.press();
    Linking.openURL('tel:+923001234567').catch(() =>
      notify('Call unavailable', `Reach ${trip.driver.name} through in-app messaging instead.`),
    );
  };

  const message = () => {
    haptics.tap();
    notify('Messages', `Chat with ${trip.driver.name} opens here once messaging is live.`);
  };

  const safety = () => {
    haptics.warning();
    notify(
      'Safety centre',
      'Share your live trip, call emergency services, or report an issue with this journey.',
    );
  };

  return (
    <Screen>
      <Header
        title="Your journey"
        subtitle={completed ? 'Journey complete' : 'Live trip details'}
        back
        onBack={() => router.back()}
        action={safety}
        actionIcon="shield-checkmark-outline"
        actionLabel="Open the safety centre"
      />

      <View
        style={[
          styles.statusCard,
          { backgroundColor: completed ? colors.green : colors.inverseSurface },
        ]}
      >
        <View style={styles.statusTop}>
          <View style={styles.statusCopy}>
            <Text
              style={[
                styles.statusEyebrow,
                { color: completed ? colors.greenSoft : colors.primary },
              ]}
            >
              {completed ? 'JOURNEY COMPLETE' : 'YOU ARE ON THE WAY'}
            </Text>
            <Text style={[styles.statusTitle, { color: colors.inverseForeground }]}>
              {completed ? 'You made it' : 'Enjoy the ride'}
            </Text>
          </View>
          <View
            style={[
              styles.liveDot,
              { backgroundColor: completed ? colors.inverseForeground : colors.primary },
            ]}
          >
            <Ionicons
              name={completed ? 'checkmark' : 'pulse'}
              size={18}
              color={completed ? colors.green : colors.charcoal}
            />
          </View>
        </View>
        <Text style={[styles.remaining, { color: colors.inverseForeground }]}>
          {completed ? `Arrived safely in ${trip.to}` : '1h 42m remaining'}
        </Text>
        <View style={styles.progress}>
          <View
            style={[
              styles.progressLine,
              { backgroundColor: completed ? colors.inverseForeground : colors.primary },
            ]}
          />
          <View
            style={[
              styles.progressLine,
              { backgroundColor: completed ? colors.inverseForeground : colors.inverseMuted },
            ]}
          />
        </View>
        <View style={styles.progressLabels}>
          <Text style={[styles.progressText, { color: colors.inverseForeground }]}>{trip.from}</Text>
          <Text style={[styles.progressText, { color: colors.inverseForeground }]}>{trip.to}</Text>
        </View>
      </View>

      <RideMapPreview
        ride={trip}
        mode="journey"
        // Rides from the API carry a numeric id behind their string one; that
        // is what the tracking endpoint is keyed on.
        rideApiId={(trip as { apiId?: number }).apiId ?? null}
      />

      <View style={[styles.nextEvent, { backgroundColor: colors.accent }]}>
        <Ionicons name="flag-outline" size={18} color={colors.primary} />
        <View style={styles.eventCopy}>
          <Text style={[styles.eventTitle, { color: colors.charcoal }]}>Next important event</Text>
          <Text style={[styles.eventText, { color: colors.mutedForeground }]}>
            {completed ? 'Trip completed at your destination' : `Drop-off at ${trip.dropoff}`}
          </Text>
        </View>
      </View>

      <Text style={[styles.section, { color: colors.charcoal }]}>Your driver</Text>
      <View style={[styles.driverCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Avatar initials={trip.driver.initials} size={46} accent />
        <View style={styles.driverCopy}>
          <Text style={[styles.driverName, { color: colors.charcoal }]}>{trip.driver.name}</Text>
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>
            {trip.vehicle.make} {trip.vehicle.model} · {trip.vehicle.plate}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Call ${trip.driver.name}`}
          onPress={call}
          style={({ pressed }) => [
            styles.call,
            { backgroundColor: colors.greenSoft, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="call" size={18} color={colors.green} />
        </Pressable>
      </View>

      <View style={styles.quickActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Message ${trip.driver.name}`}
          onPress={message}
          style={({ pressed }) => [
            styles.quick,
            { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={19} color={colors.charcoal} />
          <Text style={[styles.quickText, { color: colors.charcoal }]}>Message</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open the safety centre"
          onPress={safety}
          style={({ pressed }) => [
            styles.quick,
            { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Ionicons name="shield-checkmark-outline" size={19} color={colors.green} />
          <Text style={[styles.quickText, { color: colors.charcoal }]}>Safety</Text>
        </Pressable>
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

      <View style={styles.pillWrap}>
        <Pill
          label={completed ? 'Thanks for riding with Chalo' : `Pickup confirmed · ${trip.pickup}`}
          tone={completed ? 'green' : 'orange'}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusCard: { borderRadius: 23, padding: 19, marginBottom: 16 },
  statusTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  statusCopy: { flex: 1 },
  statusEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1 },
  statusTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, marginTop: 5 },
  liveDot: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  remaining: { fontFamily: 'Inter_600SemiBold', fontSize: 14, marginTop: 28 },
  progress: { flexDirection: 'row', gap: 4, marginTop: 16 },
  progressLine: { height: 5, borderRadius: 3, flex: 1 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  progressText: { fontFamily: 'Inter_500Medium', fontSize: 10 },
  nextEvent: {
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  eventCopy: { flex: 1 },
  eventTitle: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  eventText: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3 },
  section: { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 10 },
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
  quick: { flex: 1, borderWidth: 1, borderRadius: 15, paddingVertical: 14, alignItems: 'center', gap: 5 },
  quickText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  pillWrap: { alignItems: 'center', marginTop: 14 },
});
