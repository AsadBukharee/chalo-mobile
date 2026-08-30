import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CityMapProps } from './CityMap.types';
import { loadGoogleMaps } from './googleMapsLoader';
import { mapStyleFor } from './mapStyles';

/** A small, real Google map centred on one city — pannable and zoomable. */
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
  const containerRef = useRef<unknown>(null);
  const mapsRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then((result) => {
      if (cancelled) return;
      if (result.status !== 'ready') {
        setFailed(true);
        onUnavailable?.(result.reason);
        return;
      }
      const node = containerRef.current as unknown as HTMLElement | null;
      if (!node) return;
      mapsRef.current = result.maps;
      mapRef.current = new result.maps.Map(node, {
        center: { lat: latitude, lng: longitude },
        zoom: 11,
        disableDefaultUI: true,
        clickableIcons: false,
        gestureHandling: 'cooperative',
        maxZoom: 17,
        minZoom: 5,
        backgroundColor: isDark ? '#16222B' : '#F3EFE6',
        styles: mapStyleFor(isDark),
      });
      result.maps.event.addListenerOnce(mapRef.current, 'idle', () => {
        setMapReady(true);
        onReady?.();
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;
    map.setOptions({ styles: mapStyleFor(isDark), backgroundColor: isDark ? '#16222B' : '#F3EFE6' });
  }, [isDark, mapReady]);

  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;
    map.panTo({ lat: latitude, lng: longitude });
    const icon = {
      path: maps.SymbolPath.CIRCLE,
      scale: 9,
      fillColor: markerColor,
      fillOpacity: 1,
      strokeColor: markerRing,
      strokeWeight: 3.5,
    };
    if (!markerRef.current) {
      markerRef.current = new maps.Marker({ map, clickable: false, zIndex: 5 });
    }
    markerRef.current.setPosition({ lat: latitude, lng: longitude });
    markerRef.current.setIcon(icon);
    markerRef.current.setTitle(label);
  }, [latitude, longitude, label, markerColor, markerRing, mapReady]);

  useEffect(
    () => () => {
      markerRef.current?.setMap(null);
    },
    [],
  );

  if (failed) return null;

  return (
    <View
      testID={testID}
      ref={containerRef as any}
      accessibilityLabel={`Map of ${label}`}
      style={StyleSheet.absoluteFillObject}
    />
  );
}
