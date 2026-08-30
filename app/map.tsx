import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import { RideMapActivity, type RideMapMode } from '@/components/RideMap';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

export default function MapActivityScreen() {
  const colors = useColors();
  const { selectedRide } = useApp();
  const params = useLocalSearchParams<{ ride?: string; mode?: string }>();
  // Every caller selects the ride before navigating, so the context holds the
  // real one. Looking it up in the bundled sample list by id could only ever
  // find a demo ride, and would shadow the live one it was asked about.
  const ride = selectedRide;
  const mode: RideMapMode = params.mode === 'journey' ? 'journey' : 'route';

  if (!ride) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}><Text style={{ color: colors.charcoal }}>Route unavailable</Text></View>;
  }

  return <RideMapActivity ride={ride} mode={mode} onClose={() => router.back()} />;
}