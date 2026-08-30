import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import * as haptics from '@/components/haptics';
import { GOOGLE_MAPS_KEY } from '@/components/maps/config';
import { mapStyleFor } from '@/components/maps/mapStyles';
import {
  resolvePlace,
  reverseGeocode,
  searchPlaces,
  type PlaceSuggestion,
} from '@/components/maps/places';
import { useApp } from '@/context/AppContext';
import { useCities } from '@/hooks/useRideData';
import { useColors, useIsDark } from '@/hooks/useColors';
import type { City } from '@/data/mock';

/**
 * Where-from / where-to picker.
 *
 * The map is the screen, not a thumbnail above a list: you are choosing a
 * place, and a place is a point on a map. Search floats over it, results drop
 * down from the field, and "Set on map" sits at the top of that list — the
 * same shape Google Maps uses, because it is the affordance people already
 * know and because a dropped pin is the only way to name somewhere Places has
 * no entry for.
 */

const PAKISTAN_REGION = {
  latitude: 30.3753,
  longitude: 69.3451,
  latitudeDelta: 12,
  longitudeDelta: 12,
};

const CITY_DELTA = 0.25;
const PIN_DELTA = 0.01;

export default function LocationScreen() {
  const colors = useColors();
  const isDark = useIsDark();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ field?: string }>();
  const field = params.field === 'to' ? 'to' : 'from';
  const { from, to, setFrom, setTo } = useApp();
  const current = field === 'from' ? from : to;

  const { cities } = useCities();
  const mapRef = useRef<MapView | null>(null);
  const inputRef = useRef<TextInput | null>(null);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  /** Pin mode: the map centre becomes the chosen point. */
  const [pinMode, setPinMode] = useState(false);
  const [pinLabel, setPinLabel] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);
  const pinPoint = useRef<{ latitude: number; longitude: number } | null>(null);

  const startCity = cities.find((city: City) => city.name === current) ?? cities[0];
  const initialRegion = startCity
    ? {
        latitude: startCity.lat,
        longitude: startCity.lng,
        latitudeDelta: CITY_DELTA,
        longitudeDelta: CITY_DELTA,
      }
    : PAKISTAN_REGION;

  // Debounced Places lookup. Anything in Pakistan, not just our city list —
  // people leave from a road or a landmark, not from "Lahore" in the abstract.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(() => {
      searchPlaces(trimmed, controller.signal)
        .then((results) => {
          setSuggestions(results);
          setSearchError(results.length === 0 ? 'Nothing matched that.' : null);
        })
        .catch((error) => {
          if ((error as Error)?.name === 'AbortError') return;
          setSuggestions([]);
          setSearchError((error as Error)?.message ?? 'Search is unavailable.');
        })
        .finally(() => setSearching(false));
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const commit = useCallback(
    (name: string) => {
      haptics.success();
      if (field === 'from') setFrom(name);
      else setTo(name);
      router.back();
    },
    [field, setFrom, setTo],
  );

  /** A tapped suggestion: resolve to coordinates, show it, then accept it. */
  const choosePlace = useCallback(
    async (suggestion: PlaceSuggestion) => {
      Keyboard.dismiss();
      setResolving(true);
      try {
        const place = await resolvePlace(suggestion.id);
        mapRef.current?.animateToRegion(
          {
            latitude: place.latitude,
            longitude: place.longitude,
            latitudeDelta: PIN_DELTA,
            longitudeDelta: PIN_DELTA,
          },
          450,
        );
        commit(place.name || suggestion.primary);
      } catch {
        // Coordinates are a bonus; the name is what the rest of the app uses.
        commit(suggestion.primary);
      } finally {
        setResolving(false);
      }
    },
    [commit],
  );

  const enterPinMode = () => {
    haptics.tap();
    Keyboard.dismiss();
    setPinMode(true);
    setQuery('');
    setSuggestions([]);
  };

  /** Reverse-geocode whatever the map settled on, for a readable label. */
  const onRegionSettled = useCallback(
    (region: { latitude: number; longitude: number }) => {
      if (!pinMode) return;
      pinPoint.current = { latitude: region.latitude, longitude: region.longitude };
      setPinBusy(true);
      reverseGeocode(region.latitude, region.longitude)
        .then((address) => setPinLabel(address))
        .finally(() => setPinBusy(false));
    },
    [pinMode],
  );

  const confirmPin = () => {
    const point = pinPoint.current;
    if (!point) return;
    // The pin's coordinates are exact; the label is just what we call them.
    const label =
      pinLabel ?? `Pinned location (${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)})`;
    commit(label);
  };

  const listOpen = !pinMode && (query.trim().length > 0 || suggestions.length > 0);

  if (!GOOGLE_MAPS_KEY) {
    return (
      <View style={[styles.fill, styles.centre, { backgroundColor: colors.background }]}>
        <Ionicons name="map-outline" size={28} color={colors.mutedForeground} />
        <Text style={[styles.centreText, { color: colors.mutedForeground }]}>
          No Google Maps key is configured.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        customMapStyle={mapStyleFor(isDark)}
        onRegionChangeComplete={onRegionSettled}
        onPress={() => Keyboard.dismiss()}
        showsPointsOfInterest
        showsCompass={false}
        toolbarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        loadingEnabled
        loadingBackgroundColor={isDark ? '#16222B' : '#F3EFE6'}
      />

      {/* The pin is a fixed overlay, not a marker: the map moves under it, so
          the centre of the screen is always the point being chosen. */}
      {pinMode && (
        <View pointerEvents="none" style={styles.pinLayer}>
          <View style={[styles.pinStem, { backgroundColor: colors.charcoal }]} />
          <View style={[styles.pinHead, { backgroundColor: colors.primary, borderColor: colors.white }]}>
            <Ionicons name="location" size={17} color={colors.charcoal} />
          </View>
        </View>
      )}

      {/* Search overlay */}
      <View style={[styles.overlay, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
        <View style={styles.searchRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => (pinMode ? setPinMode(false) : router.back())}
            style={({ pressed }) => [
              styles.iconButton,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name="arrow-back" size={20} color={colors.charcoal} />
          </Pressable>

          <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="search" size={18} color={colors.mutedForeground} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              editable={!pinMode}
              placeholder={field === 'from' ? 'Where from?' : 'Where to?'}
              placeholderTextColor={colors.mutedForeground}
              accessibilityLabel={field === 'from' ? 'Search where from' : 'Search where to'}
              returnKeyType="search"
              autoCorrect={false}
              style={[styles.input, { color: colors.charcoal }]}
            />
            {searching ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : query.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => setQuery('')}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {listOpen && (
          <View style={[styles.results, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.resultsScroll}>
              {/* Pinned to the top, as in Google Maps — it is the escape hatch
                  when search cannot name the place you mean. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Set location on the map"
                onPress={enterPinMode}
                style={({ pressed }) => [
                  styles.row,
                  { borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <View style={[styles.rowIcon, { backgroundColor: colors.primary }]}>
                  <Ionicons name="location" size={17} color={colors.charcoal} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: colors.charcoal }]}>Set on map</Text>
                  <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                    Drop a pin for an exact spot
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={colors.mutedForeground} />
              </Pressable>

              {suggestions.map((suggestion) => (
                <Pressable
                  key={suggestion.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose ${suggestion.primary}`}
                  onPress={() => void choosePlace(suggestion)}
                  style={({ pressed }) => [
                    styles.row,
                    { borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <View style={[styles.rowIcon, { backgroundColor: colors.secondary }]}>
                    <Ionicons name="location-outline" size={17} color={colors.charcoal} />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.charcoal }]}>
                      {suggestion.primary}
                    </Text>
                    {!!suggestion.secondary && (
                      <Text numberOfLines={1} style={[styles.rowSub, { color: colors.mutedForeground }]}>
                        {suggestion.secondary}
                      </Text>
                    )}
                  </View>
                </Pressable>
              ))}

              {searchError && suggestions.length === 0 && (
                <View style={styles.emptyRow}>
                  <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{searchError}</Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}
      </View>

      {resolving && (
        <View style={styles.blocking} pointerEvents="none">
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {/* Pin-mode confirm sheet */}
      {pinMode && (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]} pointerEvents="box-none">
          <View style={[styles.sheetCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sheetEyebrow, { color: colors.primary }]}>
              {field === 'from' ? 'PICKUP POINT' : 'DROP-OFF POINT'}
            </Text>
            <View style={styles.sheetLabelRow}>
              {pinBusy && <ActivityIndicator size="small" color={colors.mutedForeground} />}
              <Text numberOfLines={2} style={[styles.sheetLabel, { color: colors.charcoal }]}>
                {pinBusy ? 'Finding this place…' : (pinLabel ?? 'Move the map to position the pin')}
              </Text>
            </View>
            {pinPoint.current && (
              <Text style={[styles.sheetCoords, { color: colors.mutedForeground }]}>
                {pinPoint.current.latitude.toFixed(5)}, {pinPoint.current.longitude.toFixed(5)}
              </Text>
            )}
            <View style={styles.sheetActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel picking on the map"
                onPress={() => {
                  setPinMode(false);
                  setPinLabel(null);
                }}
                style={({ pressed }) => [styles.sheetGhost, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={[styles.sheetGhostText, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Confirm this location"
                onPress={confirmPin}
                disabled={!pinPoint.current}
                style={({ pressed }) => [
                  styles.sheetConfirm,
                  {
                    backgroundColor: colors.primary,
                    opacity: !pinPoint.current ? 0.5 : pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={[styles.sheetConfirmText, { color: colors.charcoal }]}>
                  Confirm location
                </Text>
                <Ionicons name="checkmark" size={17} color={colors.charcoal} />
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centre: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  centreText: { fontFamily: 'Inter_500Medium', fontSize: 12.5 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 14 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    flex: 1,
    minHeight: 46,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    gap: 9,
  },
  input: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 14, paddingVertical: 12 },
  results: {
    marginTop: 9,
    borderRadius: 17,
    borderWidth: 1,
    overflow: 'hidden',
    maxHeight: 340,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  resultsScroll: { maxHeight: 340 },
  row: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  rowIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1 },
  rowTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13.5 },
  rowSub: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3 },
  emptyRow: { padding: 16, alignItems: 'center' },
  pinLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinStem: { position: 'absolute', top: '50%', width: 2, height: 16, borderRadius: 1 },
  pinHead: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  blocking: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14 },
  sheetCard: { borderRadius: 20, borderWidth: 1, padding: 16 },
  sheetEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.8 },
  sheetLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  sheetLabel: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 19 },
  sheetCoords: { fontFamily: 'Inter_400Regular', fontSize: 10.5, marginTop: 5 },
  sheetActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 15 },
  sheetGhost: { paddingHorizontal: 14, paddingVertical: 13 },
  sheetGhostText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  sheetConfirm: {
    flex: 1,
    minHeight: 50,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  sheetConfirmText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
});
