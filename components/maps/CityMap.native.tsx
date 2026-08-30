import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import type { CityMapProps } from './CityMap.types';
import { GOOGLE_MAPS_KEY } from './config';
import { mapStyleFor } from './mapStyles';

const DELTA = 0.22;

export default function CityMap({
  testID,
  latitude,
  longitude,
  label,
  isDark,
  markerColor,
  markerRing,
  onUnavailable,
  onReady,
}: CityMapProps) {
  const mapRef = useRef<MapView | null>(null);

  // Without a key the Android Maps SDK draws a blank grey grid and reports
  // nothing, so the caller would sit on a spinner forever. Say so instead and
  // let it fall back to the static image.
  useEffect(() => {
    if (!GOOGLE_MAPS_KEY) {
      onUnavailable?.('No Google Maps key is configured (see app.config.js).');
    }
    // Deliberately once: the key is resolved at startup and cannot change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The camera is uncontrolled. Passing `region` on every render — which this
  // component used to do — re-centres the map on each frame, so a pan snaps
  // straight back and pinch-zoom is undone the moment you lift your fingers.
  // Set the camera once, then move it imperatively when the chosen city
  // changes, leaving the user's own gestures alone in between.
  useEffect(() => {
    mapRef.current?.animateToRegion(
      { latitude, longitude, latitudeDelta: DELTA, longitudeDelta: DELTA },
      420,
    );
  }, [latitude, longitude]);

  if (!GOOGLE_MAPS_KEY) return null;

  return (
    <MapView
      ref={mapRef}
      testID={testID}
      accessibilityLabel={`Map of ${label}`}
      style={StyleSheet.absoluteFillObject}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      initialRegion={{ latitude, longitude, latitudeDelta: DELTA, longitudeDelta: DELTA }}
      customMapStyle={mapStyleFor(isDark)}
      onMapReady={onReady}
      showsPointsOfInterest={false}
      showsBuildings={false}
      showsCompass={false}
      toolbarEnabled={false}
      pitchEnabled={false}
      rotateEnabled={false}
      scrollEnabled
      zoomEnabled
      zoomControlEnabled={false}
      minZoomLevel={4}
      maxZoomLevel={17}
      loadingEnabled
      loadingBackgroundColor={isDark ? '#16222B' : '#F3EFE6'}
    >
      <Marker
        coordinate={{ latitude, longitude }}
        anchor={{ x: 0.5, y: 0.5 }}
        title={label}
        tracksViewChanges={false}
      >
        <View style={[styles.pin, { backgroundColor: markerColor, borderColor: markerRing }]} />
      </Marker>
    </MapView>
  );
}

const styles = StyleSheet.create({
  pin: { width: 20, height: 20, borderRadius: 10, borderWidth: 3.5 },
});
