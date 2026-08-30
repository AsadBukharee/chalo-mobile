/**
 * Google Maps style arrays tuned to the Chalo palette.
 *
 * The point is to strip the map back to a quiet base layer so the route
 * itself is the loudest thing on screen — POIs and transit off, roads
 * desaturated, water pulled toward the app's cool accent.
 */

export const lightMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#F3EFE6' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8C8779' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#F8F4EC' }, { weight: 3 }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#DED6C8' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#5F5A4F' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#EFEADF' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#E4EDDF' }, { visibility: 'on' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#FAF7F0' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#EDE4D2' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#E1D6BF' }] },
  { featureType: 'road.highway', elementType: 'labels', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'road.local', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#D7E7EC' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#8FA9B0' }] },
];

export const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#16222B' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#7E8D95' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#111A21' }, { weight: 3 }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#2C3D47' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#9FB0B8' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#182530' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1B2E2A' }, { visibility: 'on' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#243441' }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#263745' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#33485A' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#3E566B' }] },
  { featureType: 'road.highway', elementType: 'labels', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'road.local', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0E1B24' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4C6470' }] },
];

export const mapStyleFor = (isDark: boolean) => (isDark ? darkMapStyle : lightMapStyle);
