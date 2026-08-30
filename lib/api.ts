import Constants from 'expo-constants';
import { firebaseAuth } from './firebase';

/**
 * Client for the Chalo API.
 *
 * Every rider request carries the Firebase ID token as a bearer credential —
 * the same token the phone-OTP sign-in produces. The server verifies it and
 * creates the account on first use, so the app never sends a password and has
 * no registration call to make.
 *
 * The base URL comes from `extra.apiBaseUrl` (app.config.js), overridable with
 * EXPO_PUBLIC_API_BASE_URL. Trailing slashes matter to Django: APPEND_SLASH
 * turns a missing one into a 301, and a 301 on a POST silently drops the body,
 * so every path here ends in `/`.
 */

const configuredBase =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ||
  '';

export const API_BASE_URL = configuredBase.replace(/\/+$/, '');
export const API_CONFIGURED = API_BASE_URL.length > 0;

const DEFAULT_TIMEOUT_MS = 20000;

export class ApiError extends Error {
  readonly status: number;
  /** DRF's field-level errors, e.g. { seats: ["Seat 2 already taken."] }. */
  readonly fields: Record<string, string[]>;

  constructor(message: string, status: number, fields: Record<string, string[]> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
  }

  get isAuthError() {
    return this.status === 401 || this.status === 403;
  }
}

/** Turns a DRF error body into one sentence a person can act on. */
function describe(status: number, body: unknown): ApiError {
  // 401 always means the same thing here, and the server's own words for it
  // are SimpleJWT's ("Given token not valid for any token type") — accurate,
  // and meaningless to a rider whose Firebase token simply aged out.
  if (status === 401) return new ApiError('Your session has expired. Please sign in again.', status);

  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;

    if (typeof record.detail === 'string') {
      return new ApiError(record.detail, status);
    }

    const fields: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(record)) {
      if (Array.isArray(value)) fields[key] = value.map(String);
      else if (typeof value === 'string') fields[key] = [value];
    }
    const first = Object.values(fields)[0]?.[0];
    if (first) return new ApiError(first, status, fields);
  }

  if (status >= 500) return new ApiError('The server had a problem. Try again shortly.', status);
  return new ApiError(`Request failed (${status}).`, status);
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Send the Firebase token. Off for the open endpoints. */
  auth?: boolean;
  signal?: AbortSignal;
  query?: Record<string, string | number | undefined | null>;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!API_CONFIGURED) {
    throw new ApiError(
      'No API URL is configured. Set EXPO_PUBLIC_API_BASE_URL and restart Metro with `npx expo start -c`.',
      0,
    );
  }

  const { method = 'GET', body, auth = true, signal, query } = options;

  const url = new URL(`${API_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = await firebaseAuth.getIdToken();
    if (!token) throw new ApiError('You are signed out.', 401);
    headers.Authorization = `Bearer ${token}`;
  }

  // A hung request on a bad connection should fail, not spin forever.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener?.('abort', onAbort);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError' && !signal?.aborted) {
      throw new ApiError('The server took too long to respond.', 0);
    }
    if ((error as Error)?.name === 'AbortError') throw error;
    throw new ApiError('Could not reach the server. Check your connection.', 0);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', onAbort);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // Django's 500 page and Vercel's error pages are HTML, not JSON.
      if (!response.ok) {
        throw new ApiError(`The server returned an error (${response.status}).`, response.status);
      }
    }
  }

  if (!response.ok) throw describe(response.status, parsed);
  return parsed as T;
}

/* -------------------------------------------------------------------------- */
/*  Shapes returned by the API                                                */
/* -------------------------------------------------------------------------- */

export type ApiUser = {
  id: number;
  phone: string | null;
  email: string | null;
  full_name: string;
  display_name: string;
  is_phone_verified: boolean;
  is_staff: boolean;
  created_at: string;
};

export type SessionResult = { created: boolean; user: ApiUser };

export type ApiCity = {
  id: number;
  name: string;
  region: string;
  short: string;
  latitude: string;
  longitude: string;
};

export type ApiDriver = {
  id: number;
  name: string;
  initials: string;
  bio: string;
  rating: string;
  completed_trips: number;
  years_experience: number;
  response_rate: number;
  cancellation_rate: number;
  photo_url: string;
  status: string;
};

export type ApiVehicle = {
  id: number;
  make: string;
  model: string;
  year: number;
  color: string;
  plate: string;
  seats: number;
  features: string[];
};

export type ApiRide = {
  id: number;
  driver: ApiDriver;
  vehicle: ApiVehicle;
  origin: ApiCity;
  destination: ApiCity;
  departs_at: string;
  arrives_at: string;
  duration_minutes: number;
  pickup_point: string;
  dropoff_point: string;
  pickup_latitude: string | null;
  pickup_longitude: string | null;
  dropoff_latitude: string | null;
  dropoff_longitude: string | null;
  price_per_seat: string;
  total_seats: number;
  seats_left: number;
  /** Seat labels already booked, e.g. ["1", "3"]. */
  taken_seats: string[];
  status: string;
  is_recommended: boolean;
};

/** One reported vehicle position, plus how stale it is. */
export type ApiRideLocation = {
  latitude: string;
  longitude: string;
  heading_degrees: number | null;
  speed_mps: number | null;
  accuracy_m: number | null;
  recorded_at: string;
  age_seconds: number;
};

export type ApiBooking = {
  id: number;
  reference: string;
  ride: ApiRide;
  seats: string[];
  seat_count: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  total_price: string;
  created_at: string;
};

type Paginated<T> = { count: number; next: string | null; results: T[] };

/** Endpoints without pagination return a bare array; tolerate both. */
function items<T>(payload: Paginated<T> | T[] | null): T[] {
  if (!payload) return [];
  return Array.isArray(payload) ? payload : (payload.results ?? []);
}

/* -------------------------------------------------------------------------- */
/*  Endpoints                                                                 */
/* -------------------------------------------------------------------------- */

export const api = {
  health: () => request<{ status: string }>('/api/health/', { auth: false }),

  /**
   * Exchanges the Firebase token for an account, creating it if this is the
   * first time this number has been seen. `created` is what the welcome screen
   * branches on.
   */
  session: (fullName?: string) =>
    request<SessionResult>('/api/auth/session/', {
      method: 'POST',
      body: fullName ? { full_name: fullName } : {},
    }),

  me: (signal?: AbortSignal) => request<ApiUser>('/api/auth/me/', { signal }),

  updateMe: (patch: { full_name: string }) =>
    request<ApiUser>('/api/auth/me/', { method: 'PATCH', body: patch }),

  registerDeviceToken: (token: string, platform: 'android' | 'ios' | 'web') =>
    request<unknown>('/api/auth/device-token/', {
      method: 'POST',
      body: { token, platform },
    }),

  removeDeviceToken: (token: string) =>
    request<void>('/api/auth/device-token/', { method: 'DELETE', body: { token } }),

  /** Pushes a notification to this account's own devices. Test harness. */
  sendTestPush: (title?: string, body?: string) =>
    request<{ devices: number; delivered: number }>('/api/notifications/test/', {
      method: 'POST',
      body: { title, body },
    }),

  cities: (signal?: AbortSignal) =>
    request<Paginated<ApiCity> | ApiCity[]>('/api/cities/', { auth: false, signal }).then(items),

  searchRides: (
    params: { origin?: string; destination?: string; date?: string; seats?: number },
    signal?: AbortSignal,
  ) =>
    request<Paginated<ApiRide> | ApiRide[]>('/api/rides/', {
      auth: false,
      signal,
      query: params,
    }).then(items),

  ride: (id: number, signal?: AbortSignal) =>
    request<ApiRide>(`/api/rides/${id}/`, { auth: false, signal }),

  bookings: (signal?: AbortSignal) =>
    request<Paginated<ApiBooking> | ApiBooking[]>('/api/bookings/', { signal }).then(items),

  createBooking: (rideId: number, seats: string[]) =>
    request<ApiBooking>('/api/bookings/', {
      method: 'POST',
      body: { ride_id: rideId, seats },
    }),

  cancelBooking: (id: number) =>
    request<ApiBooking>(`/api/bookings/${id}/cancel/`, { method: 'POST', body: {} }),

  myDriverApplication: (signal?: AbortSignal) =>
    request<unknown>('/api/drivers/me/', { signal }),

  /**
   * The driver's phone number, for someone on this ride.
   *
   * Not in the ride payload: a driver's mobile in every search result is a
   * phone list waiting to be scraped. 403 for anyone without a live booking.
   */
  rideContact: (rideId: number, signal?: AbortSignal) =>
    request<{ name: string; phone: string; vehicle: string; plate: string }>(
      `/api/rides/${rideId}/contact/`,
      { signal },
    ),

  /** Where the vehicle is now. 404 until the driver has shared a position. */
  rideLocation: (rideId: number, signal?: AbortSignal) =>
    request<ApiRideLocation>(`/api/rides/${rideId}/location/`, { signal }),

  /** Driver-only: report this vehicle's position. */
  reportRideLocation: (
    rideId: number,
    position: {
      latitude: number;
      longitude: number;
      heading_degrees?: number | null;
      speed_mps?: number | null;
      accuracy_m?: number | null;
    },
  ) =>
    request<unknown>(`/api/rides/${rideId}/location/`, {
      method: 'POST',
      body: position,
    }),
};
