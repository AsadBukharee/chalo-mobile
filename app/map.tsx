import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import { RideMapActivity, type RideMapMode } from '@/components/RideMap';
import { useApp } from '@/context/AppContext';
import { rides } from '@/data/mock';
import { useColors } from '@/hooks/useColors';

export default function MapActivityScreen() {
  const colors = useColors();
  const { selectedRide } = useApp();
  const params = useLocalSearchParams<{ ride?: string; mode?: string }>();
  const ride = rides.find((item) => item.id === params.ride) ?? selectedRide;
  const mode: RideMapMode = params.mode === 'journey' ? 'journey' : 'route';

  if (!ride) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}><Text style={{ color: colors.charcoal }}>Route unavailable</Text></View>;
  }

  return <RideMapActivity ride={ride} mode={mode} onClose={() => router.back()} />;
}