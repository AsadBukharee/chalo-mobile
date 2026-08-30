import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Celebration } from '@/components/Celebration';
import { Avatar, Header, Pill, PrimaryButton, Screen, SecondaryButton } from '@/components/ChaloUI';
import * as haptics from '@/components/haptics';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { useCreateBooking } from '@/hooks/useRideData';
import { formatE164 } from '@/lib/phone';

/**
 * Seat picker → review → confirmation.
 *
 * The seat grid is drawn from the vehicle the driver actually registered and
 * the seats the server says are gone, not a fixed four with the first one
 * greyed out. The booking itself is made by the API: it owns the reference,
 * the price and the last word on whether a seat is still free, because two
 * riders can be on this screen at the same time and only one of them can have
 * seat 3.
 */
export default function BookingScreen() {
  const colors = useColors();
  const { selectedRide: ride, selectedSeats, toggleSeat, confirmBooking, date } = useApp();
  const { profile } = useAuth();
  const createBooking = useCreateBooking();

  const [stage, setStage] = useState<'seats' | 'review' | 'confirmed'>('seats');
  const [confirmation, setConfirmation] = useState<{ reference: string; seats: string[] } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  // The car the driver registered, not a hard-coded four-seater.
  const seats = useMemo(
    () => Array.from({ length: ride.vehicle?.seats || 4 }, (_, index) => String(index + 1)),
    [ride.vehicle?.seats],
  );
  const takenSeats = useMemo(() => new Set(ride.takenSeats ?? []), [ride.takenSeats]);

  const fare = ride.price * selectedSeats.length;

  const confirm = async () => {
    setError(null);

    // A ride that came from the bundled sample data has no server id, so there
    // is nothing to book. Better to say so than to fake a confirmation.
    if (!ride.apiId) {
      setError('This ride is not available to book right now. Search again to refresh the list.');
      return;
    }

    try {
      const booking = await createBooking.mutateAsync({
        rideId: ride.apiId,
        seats: selectedSeats,
      });
      confirmBooking({ reference: booking.reference, seats: booking.seats });
      setConfirmation({ reference: booking.reference, seats: booking.seats });
      haptics.success();
      setStage('confirmed');
    } catch (caught) {
      // ApiError carries the server's own sentence — "Seat(s) already taken: 3."
      // is far more use than "booking failed".
      setError((caught as Error)?.message ?? 'The booking could not be completed.');
      haptics.warning();
    }
  };

  if (stage === 'confirmed') {
    const booked = confirmation?.seats ?? selectedSeats;
    return (
      <View style={styles.root}>
        <Screen>
          <View style={styles.confirmed}>
            <View style={[styles.successCircle, { backgroundColor: colors.greenSoft }]}>
              <View style={[styles.successInner, { backgroundColor: colors.green }]}>
                <Ionicons name="checkmark" size={34} color={colors.primaryForeground} />
              </View>
            </View>
            <Text style={[styles.confirmTitle, { color: colors.charcoal }]}>Booking confirmed</Text>
            <Text style={[styles.confirmBody, { color: colors.mutedForeground }]}>
              Your ride to {ride.to} is confirmed. We&apos;ll keep you updated.
            </Text>
            <View style={[styles.ticket, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.ticketTop}>
                <View>
                  <Text style={[styles.ticketLabel, { color: colors.mutedForeground }]}>
                    BOOKING REFERENCE
                  </Text>
                  <Text style={[styles.reference, { color: colors.charcoal }]}>
                    {confirmation?.reference ?? '—'}
                  </Text>
                </View>
                <View style={[styles.qr, { borderColor: colors.charcoal }]}>
                  <View style={[styles.qrBlock, { backgroundColor: colors.charcoal }]} />
                  <View style={[styles.qrBlock, { backgroundColor: colors.charcoal }]} />
                  <View style={[styles.qrBlock, { backgroundColor: colors.charcoal }]} />
                  <View style={[styles.qrBlock, { backgroundColor: colors.charcoal }]} />
                </View>
              </View>
              <View style={[styles.ticketDivider, { borderColor: colors.border }]} />
              <Text style={[styles.ticketRoute, { color: colors.charcoal }]}>
                {ride.from} → {ride.to}
              </Text>
              <Text style={[styles.ticketDetails, { color: colors.mutedForeground }]}>
                {ride.departure} · {ride.vehicle.make} {ride.vehicle.model} · Seat
                {booked.length > 1 ? 's' : ''} {booked.join(', ')}
              </Text>
            </View>
            <PrimaryButton
              label="View my trip"
              icon="arrow-forward"
              onPress={() => router.replace('/journey')}
            />
            <SecondaryButton label="Back to home" onPress={() => router.replace('/(tabs)')} />
          </View>
        </Screen>
        <Celebration active />
      </View>
    );
  }

  if (stage === 'review') {
    return (
      <Screen>
        <Header title="Review booking" subtitle="Almost there" back onBack={() => setStage('seats')} />
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.summaryRoute}>
            <Text style={[styles.summaryCity, { color: colors.charcoal }]}>{ride.from}</Text>
            <Ionicons name="arrow-forward" size={17} color={colors.primary} />
            <Text style={[styles.summaryCity, { color: colors.charcoal }]}>{ride.to}</Text>
          </View>
          <Text style={[styles.summaryDate, { color: colors.mutedForeground }]}>
            {date} · {ride.departure}
          </Text>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.charcoal }]}>Passenger</Text>
        <View style={[styles.personRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Avatar initials={initialsFor(profile?.display_name ?? '')} size={38} accent />
          <View style={styles.personCopy}>
            <Text style={[styles.personName, { color: colors.charcoal }]}>
              {profile?.full_name || profile?.display_name || 'You'}
            </Text>
            <Text style={[styles.muted, { color: colors.mutedForeground }]}>
              {profile?.phone ? formatE164(profile.phone) : '—'}
            </Text>
          </View>
          {profile?.is_phone_verified && (
            <Ionicons name="checkmark-circle" size={20} color={colors.green} />
          )}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.charcoal }]}>Fare breakdown</Text>
        <View style={[styles.fareCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.fareLine}>
            <Text style={[styles.muted, { color: colors.mutedForeground }]}>
              Rs. {ride.price.toLocaleString()} × {selectedSeats.length} seat
              {selectedSeats.length > 1 ? 's' : ''}
            </Text>
            <Text style={[styles.lineAmount, { color: colors.charcoal }]}>
              Rs. {fare.toLocaleString()}
            </Text>
          </View>
          <View style={[styles.fareDivider, { backgroundColor: colors.border }]} />
          <View style={styles.fareLine}>
            <Text style={[styles.totalLabel, { color: colors.charcoal }]}>Total</Text>
            <Text style={[styles.total, { color: colors.charcoal }]}>Rs. {fare.toLocaleString()}</Text>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.charcoal }]}>Your ride</Text>
        <View style={[styles.personRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Avatar initials={ride.driver.initials} size={38} />
          <View style={styles.personCopy}>
            <Text style={[styles.personName, { color: colors.charcoal }]}>{ride.driver.name}</Text>
            <Text style={[styles.muted, { color: colors.mutedForeground }]}>
              {ride.vehicle.make} {ride.vehicle.model} · {ride.pickup}
            </Text>
          </View>
          <Pill label="Verified" tone="green" />
        </View>

        {error && (
          <View style={[styles.errorBox, { backgroundColor: colors.accent }]}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.primary} />
            <Text style={[styles.errorText, { color: colors.charcoal }]}>{error}</Text>
          </View>
        )}

        <Text style={[styles.policy, { color: colors.mutedForeground }]}>
          Free cancellation up to 2 hours before departure.
        </Text>
        <PrimaryButton
          label="Confirm booking"
          icon="checkmark"
          loading={createBooking.isPending}
          disabled={createBooking.isPending || selectedSeats.length === 0}
          onPress={() => void confirm()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header
        title="Choose your seat"
        subtitle={`${ride.vehicle.make} ${ride.vehicle.model} · ${ride.seatsLeft} available`}
        back
        onBack={() => router.back()}
      />
      <View style={styles.instruction}>
        <View style={[styles.infoIcon, { backgroundColor: colors.accent }]}>
          <Ionicons name="information" size={16} color={colors.primary} />
        </View>
        <Text style={[styles.instructionText, { color: colors.mutedForeground }]}>
          {selectedSeats.length === 0
            ? 'Pick a seat for your journey'
            : `Pick ${selectedSeats.length === 1 ? 'a seat' : `${selectedSeats.length} seats`} for your journey`}
        </Text>
      </View>

      <View style={[styles.car, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.windshield, { backgroundColor: colors.secondary }]}>
          <Ionicons name="speedometer-outline" size={20} color={colors.mutedForeground} />
          <Text style={[styles.windshieldText, { color: colors.mutedForeground }]}>DRIVER</Text>
        </View>
        <View style={styles.seatGrid}>
          {seats.map((seat, index) => {
            const occupied = takenSeats.has(seat);
            const selected = selectedSeats.includes(seat);
            return (
              <Pressable
                key={seat}
                disabled={occupied}
                onPress={() => {
                  haptics.selection();
                  toggleSeat(seat);
                }}
                accessibilityRole="button"
                accessibilityState={{ disabled: occupied, selected }}
                accessibilityLabel={`Seat ${seat} ${occupied ? 'occupied' : selected ? 'selected' : 'available'}`}
                style={[
                  styles.seat,
                  {
                    backgroundColor: occupied
                      ? colors.muted
                      : selected
                        ? colors.primary
                        : colors.card,
                    borderColor: selected ? colors.primary : colors.border,
                    opacity: occupied ? 0.55 : 1,
                  },
                  index % 2 === 1 && styles.rightSeat,
                ]}
              >
                <Text
                  style={[
                    styles.seatNumber,
                    {
                      color: selected
                        ? colors.primaryForeground
                        : occupied
                          ? colors.mutedForeground
                          : colors.charcoal,
                    },
                  ]}
                >
                  {seat}
                </Text>
                <Text
                  style={[
                    styles.seatStatus,
                    { color: selected ? colors.primaryForeground : colors.mutedForeground },
                  ]}
                >
                  {occupied ? 'Taken' : selected ? 'You' : 'Open'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={[styles.carFooter, { borderTopColor: colors.border }]}>
          <View style={styles.legend}>
            <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Selected</Text>
          </View>
          <View style={styles.legend}>
            <View style={[styles.legendDot, { backgroundColor: colors.muted }]} />
            <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Occupied</Text>
          </View>
          <View style={styles.legend}>
            <View
              style={[
                styles.legendDot,
                { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
              ]}
            />
            <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Available</Text>
          </View>
        </View>
      </View>

      <View style={styles.seatBottom}>
        <View>
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>YOUR FARE</Text>
          <Text style={[styles.fare, { color: colors.charcoal }]}>
            Rs. {fare.toLocaleString()}
          </Text>
        </View>
        <PrimaryButton
          label="Continue"
          icon="arrow-forward"
          disabled={!selectedSeats.length}
          onPress={() => {
            setError(null);
            setStage('review');
          }}
        />
      </View>
    </Screen>
  );
}

/** "Asad Abbas" → "AA". Falls back to a single letter, then to a placeholder. */
function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '·';
  return parts
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  confirmed: { alignItems: 'center', paddingTop: 42 },
  successCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 25,
  },
  successInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTitle: { fontFamily: 'Inter_700Bold', fontSize: 28, letterSpacing: -0.8 },
  confirmBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 280,
  },
  ticket: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 17,
    width: '100%',
    marginTop: 28,
    marginBottom: 18,
  },
  ticketTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1 },
  reference: { fontFamily: 'Inter_700Bold', fontSize: 20, marginTop: 5 },
  qr: { width: 46, height: 46, borderWidth: 3, padding: 4, flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  qrBlock: { width: 13, height: 13 },
  ticketDivider: { borderTopWidth: 1, borderStyle: 'dashed', marginVertical: 17 },
  ticketRoute: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  ticketDetails: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 5 },
  summaryCard: { borderRadius: 18, borderWidth: 1, padding: 17, marginBottom: 24 },
  summaryRoute: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryCity: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  summaryDate: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 8 },
  sectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 14, marginBottom: 9 },
  personRow: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  personCopy: { flex: 1 },
  personName: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  muted: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3 },
  fareCard: { borderWidth: 1, borderRadius: 16, padding: 15, marginBottom: 20 },
  fareLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lineAmount: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  fareDivider: { height: 1, marginVertical: 14 },
  totalLabel: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  total: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 13,
    padding: 12,
    marginBottom: 14,
  },
  errorText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17 },
  policy: { fontFamily: 'Inter_400Regular', fontSize: 10, textAlign: 'center', marginBottom: 14 },
  instruction: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 13 },
  infoIcon: { width: 27, height: 27, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  instructionText: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  car: { borderWidth: 1, borderRadius: 24, padding: 15, alignItems: 'center' },
  windshield: {
    height: 59,
    width: '76%',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  windshieldText: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1 },
  seatGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 11,
    paddingVertical: 22,
  },
  seat: {
    width: '43%',
    height: 74,
    borderWidth: 1.5,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  rightSeat: { marginRight: 0 },
  seatNumber: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  seatStatus: { fontFamily: 'Inter_500Medium', fontSize: 10, marginTop: 3 },
  carFooter: {
    borderTopWidth: 1,
    width: '100%',
    paddingTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  seatBottom: {
    marginTop: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 15,
  },
  fare: { fontFamily: 'Inter_700Bold', fontSize: 22, marginTop: 3 },
});
