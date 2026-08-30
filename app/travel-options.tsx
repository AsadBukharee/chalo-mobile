import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Header, InfoBanner, PrimaryButton, Screen } from '@/components/ChaloUI';
import * as haptics from '@/components/haptics';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MAX_PASSENGERS = 4;

/** Two weeks of real dates starting today, rather than a frozen list. */
function useDateOptions() {
  return useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 14 }, (_, offset) => {
      const date = new Date(today);
      date.setDate(today.getDate() + offset);
      const weekday = WEEKDAYS[date.getDay()]!;
      const value = `${weekday.charAt(0)}${weekday.slice(1, 3).toLowerCase()}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
      return {
        value,
        day: String(date.getDate()),
        weekday,
        label: offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : MONTHS[date.getMonth()]!,
      };
    });
  }, []);
}

export default function TravelOptionsScreen() {
  const colors = useColors();
  const { date, passengers, setDate, setPassengers } = useApp();
  const dates = useDateOptions();

  // If the stored date is stale (an old session), fall back to today.
  const selected = dates.some((item) => item.value === date) ? date : dates[0]!.value;

  return (
    <Screen>
      <Header
        title="Travel details"
        subtitle="When and who is travelling?"
        back
        onBack={() => router.back()}
      />

      <Text style={[styles.section, { color: colors.charcoal }]}>Select date</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dates}
      >
        {dates.map((item) => {
          const active = selected === item.value;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}, ${item.value}`}
              accessibilityState={{ selected: active }}
              onPress={() => {
                haptics.selection();
                setDate(item.value);
              }}
              style={({ pressed }) => [
                styles.date,
                {
                  backgroundColor: active ? colors.charcoal : colors.card,
                  borderColor: active ? colors.charcoal : colors.border,
                  opacity: pressed && !active ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.weekday,
                  { color: active ? colors.primary : colors.mutedForeground },
                ]}
              >
                {item.weekday}
              </Text>
              <Text style={[styles.day, { color: active ? colors.background : colors.charcoal }]}>
                {item.day}
              </Text>
              <Text
                style={[
                  styles.dateLabel,
                  { color: active ? colors.muted : colors.mutedForeground },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={[styles.section, { color: colors.charcoal }]}>Passengers</Text>
      <View style={[styles.passengerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.personIcon, { backgroundColor: colors.accent }]}>
          <Ionicons name="person-outline" size={21} color={colors.primary} />
        </View>
        <View style={styles.passengerCopy}>
          <Text style={[styles.passengerTitle, { color: colors.charcoal }]}>
            {passengers} passenger{passengers > 1 ? 's' : ''}
          </Text>
          <Text style={[styles.passengerBody, { color: colors.mutedForeground }]}>
            Each passenger reserves one seat
          </Text>
        </View>
        <View style={styles.stepper}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove a passenger"
            accessibilityState={{ disabled: passengers === 1 }}
            disabled={passengers === 1}
            onPress={() => {
              haptics.selection();
              setPassengers(passengers - 1);
            }}
            style={({ pressed }) => [
              styles.step,
              { backgroundColor: colors.secondary, opacity: passengers === 1 ? 0.4 : pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name="remove" size={17} color={colors.charcoal} />
          </Pressable>
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.count, { color: colors.charcoal }]}
          >
            {passengers}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a passenger"
            accessibilityState={{ disabled: passengers === MAX_PASSENGERS }}
            disabled={passengers === MAX_PASSENGERS}
            onPress={() => {
              haptics.selection();
              setPassengers(passengers + 1);
            }}
            style={({ pressed }) => [
              styles.step,
              {
                backgroundColor: colors.charcoal,
                opacity: passengers === MAX_PASSENGERS ? 0.4 : pressed ? 0.8 : 1,
              },
            ]}
          >
            <Ionicons name="add" size={17} color={colors.background} />
          </Pressable>
        </View>
      </View>

      <View style={styles.bannerWrap}>
        <InfoBanner
          icon="information-circle-outline"
          tone="green"
          text="You'll select your exact seats once you choose a ride."
        />
      </View>

      <View style={styles.bottom}>
        <PrimaryButton label="Save travel details" icon="checkmark" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 11 },
  dates: { gap: 8, paddingRight: 20, paddingBottom: 4 },
  date: {
    width: 78,
    minHeight: 112,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekday: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.6 },
  day: { fontFamily: 'Inter_700Bold', fontSize: 26, marginVertical: 5 },
  dateLabel: { fontFamily: 'Inter_400Regular', fontSize: 9 },
  passengerCard: {
    borderWidth: 1,
    borderRadius: 19,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  personIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  passengerCopy: { flex: 1 },
  passengerTitle: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  passengerBody: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 4 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  step: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  count: { minWidth: 16, textAlign: 'center', fontFamily: 'Inter_700Bold', fontSize: 15 },
  bannerWrap: { marginTop: 20 },
  bottom: { marginTop: 'auto', paddingTop: 28 },
});
