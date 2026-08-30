import { useQuery } from '@tanstack/react-query';
import { api, API_CONFIGURED } from '@/lib/api';
import { toCity, toRide, type LiveRide } from '@/lib/adapters';
import { cities as bundledCities, type City } from '@/data/mock';

/**
 * Ride and city data from the API.
 *
 * Cities fall back to the bundled list when the API is unreachable — they are
 * a fixed reference set that barely changes, and a search screen with no
 * cities is useless. Rides deliberately do *not* fall back: showing invented
 * rides that cannot be booked is worse than showing none, so an empty or
 * failed search says so.
 */

const FIVE_MINUTES = 5 * 60 * 1000;

export function useCities() {
  const query = useQuery({
    queryKey: ['cities'],
    queryFn: ({ signal }) => api.cities(signal).then((list) => list.map(toCity)),
    enabled: API_CONFIGURED,
    staleTime: FIVE_MINUTES,
    retry: 1,
  });

  const cities: City[] = query.data?.length ? query.data : bundledCities;

  return {
    cities,
    /** True when the list above is the bundled one rather than the server's. */
    isFallback: !query.data?.length,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

export type RideSearchParams = {
  origin?: string;
  destination?: string;
  /** YYYY-MM-DD. */
  date?: string;
  seats?: number;
};

export function useRideSearch(params: RideSearchParams, enabled = true) {
  const query = useQuery({
    queryKey: ['rides', params],
    queryFn: ({ signal }) => api.searchRides(params, signal).then((list) => list.map(toRide)),
    enabled: enabled && API_CONFIGURED,
    staleTime: 60 * 1000,
    retry: 1,
  });

  return {
    rides: (query.data ?? []) as LiveRide[],
    isLoading: query.isLoading || query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch,
    /** No API URL configured at all — a setup problem, not an empty result. */
    unconfigured: !API_CONFIGURED,
  };
}

export function useMyBookings() {
  const query = useQuery({
    queryKey: ['bookings'],
    queryFn: ({ signal }) => api.bookings(signal),
    enabled: API_CONFIGURED,
    staleTime: 30 * 1000,
  });

  return {
    bookings: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
