import { GOOGLE_MAPS_KEY } from './config';

/**
 * Places API (New) and Geocoding.
 *
 * The legacy `maps/api/place/autocomplete/json` endpoint cannot be enabled on
 * projects created from 2025 onward, so this uses the v1 endpoints: POST, key
 * in a header, and a field mask that governs both the response and the billing
 * SKU.
 *
 * Autocomplete is deliberately not restricted to `(cities)` the way the old
 * implementation was — someone booking a ride wants to name the actual place
 * they are leaving from, not the nearest city Google knows about.
 */

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const DETAILS_URL = 'https://places.googleapis.com/v1/places';
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

const TIMEOUT_MS = 10000;

/** Roughly the bounding box of Pakistan, to bias results without excluding. */
const PAKISTAN_CENTRE = { latitude: 30.3753, longitude: 69.3451 };
const PAKISTAN_RADIUS_M = 900000;

export type PlaceSuggestion = {
  /** Places resource id, for looking up coordinates on selection. */
  id: string;
  /** "Liberty Market" */
  primary: string;
  /** "Gulberg, Lahore, Pakistan" */
  secondary: string;
};

export type ResolvedPlace = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

export class PlacesError extends Error {}

async function post(url: string, body: unknown, fieldMask: string, signal?: AbortSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener?.('abort', onAbort);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_KEY,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const parsed = await response.json().catch(() => null);
    if (!response.ok) {
      throw new PlacesError(parsed?.error?.message ?? `Places request failed (${response.status}).`);
    }
    return parsed;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', onAbort);
  }
}

/**
 * Type-ahead suggestions for anywhere in Pakistan.
 *
 * `includedRegionCodes` keeps results inside the country; the location bias
 * pushes nearby matches up without hard-excluding anything outside the circle.
 */
export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (!GOOGLE_MAPS_KEY || trimmed.length < 2) return [];

  const body = await post(
    AUTOCOMPLETE_URL,
    {
      input: trimmed,
      includedRegionCodes: ['pk'],
      languageCode: 'en',
      regionCode: 'PK',
      locationBias: {
        circle: {
          center: { latitude: PAKISTAN_CENTRE.latitude, longitude: PAKISTAN_CENTRE.longitude },
          radius: PAKISTAN_RADIUS_M,
        },
      },
    },
    'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat',
    signal,
  );

  return (body?.suggestions ?? [])
    .map((item: any) => item?.placePrediction)
    .filter(Boolean)
    .slice(0, 8)
    .map((prediction: any) => ({
      id: prediction.placeId as string,
      primary: prediction.structuredFormat?.mainText?.text ?? '',
      secondary: prediction.structuredFormat?.secondaryText?.text ?? '',
    }))
    .filter((suggestion: PlaceSuggestion) => suggestion.id && suggestion.primary);
}

/** Coordinates for a suggestion the user tapped. */
export async function resolvePlace(placeId: string, signal?: AbortSignal): Promise<ResolvedPlace> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener?.('abort', onAbort);

  try {
    const response = await fetch(`${DETAILS_URL}/${encodeURIComponent(placeId)}`, {
      headers: {
        'X-Goog-Api-Key': GOOGLE_MAPS_KEY,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,location',
      },
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new PlacesError(body?.error?.message ?? `Could not load that place (${response.status}).`);
    }
    if (!body?.location) throw new PlacesError('That place has no coordinates.');

    return {
      id: body.id ?? placeId,
      name: body.displayName?.text ?? '',
      address: body.formattedAddress ?? '',
      latitude: body.location.latitude,
      longitude: body.location.longitude,
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', onAbort);
  }
}

/**
 * A human-readable address for a dropped pin.
 *
 * Best-effort: the pin's coordinates are the real answer, and a failure here
 * only costs a nice label, so this resolves to null rather than throwing.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<string | null> {
  if (!GOOGLE_MAPS_KEY) return null;

  const params = new URLSearchParams({
    latlng: `${latitude},${longitude}`,
    language: 'en',
    region: 'pk',
    key: GOOGLE_MAPS_KEY,
  });

  try {
    const response = await fetch(`${GEOCODE_URL}?${params.toString()}`, { signal });
    const body = await response.json();
    if (body?.status !== 'OK') return null;
    const results: any[] = body.results ?? [];
    // Skip plus-code style results; the first street/locality one reads better.
    const best =
      results.find((item) => !item.types?.includes('plus_code')) ?? results[0] ?? null;
    return best?.formatted_address ?? null;
  } catch {
    return null;
  }
}
