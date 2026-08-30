import type { ApiCity, ApiRide } from './api';
import type { City, Driver, Ride, Vehicle } from '@/data/mock';

/**
 * Translates API payloads into the shapes the screens already render.
 *
 * The UI was built against `data/mock.ts`, and those types are a perfectly good
 * view model — pre-formatted times, a `duration` string, a flat price. Adapting
 * here means the API swap touches the data layer only, instead of rewriting
 * every screen around snake_case DRF output.
 *
 * `apiId` rides along because bookings are created by numeric id, while the
 * existing `Ride.id` is a string the map's bundled route data keys off.
 */

export type LiveRide = Ride & { apiId: number };

function clock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--';
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(display).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function duration(minutes: number): string {
  if (!minutes || minutes <= 0) return '—';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

export function toCity(city: ApiCity): City {
  return {
    name: city.name,
    region: city.region,
    short: city.short,
    lat: Number(city.latitude),
    lng: Number(city.longitude),
  };
}

function toDriver(ride: ApiRide): Driver {
  const driver = ride.driver;
  return {
    id: String(driver.id),
    name: driver.name,
    initials: driver.initials,
    rating: Number(driver.rating),
    trips: driver.completed_trips,
    years: driver.years_experience,
    responseRate: `${driver.response_rate}%`,
    cancellationRate: `${driver.cancellation_rate}%`,
    bio: driver.bio,
    // Reviews aren't modelled server-side yet; an empty list renders as
    // "no reviews", which is honest, rather than borrowed mock text.
    reviews: [],
  };
}

function toVehicle(ride: ApiRide): Vehicle {
  const vehicle = ride.vehicle;
  return {
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    color: vehicle.color,
    plate: vehicle.plate,
    seats: vehicle.seats,
    features: vehicle.features ?? [],
  };
}

export function toRide(ride: ApiRide): LiveRide {
  return {
    apiId: ride.id,
    id: `ride-${ride.id}`,
    from: ride.origin.name,
    to: ride.destination.name,
    departure: clock(ride.departs_at),
    arrival: clock(ride.arrives_at),
    duration: duration(ride.duration_minutes),
    price: Number(ride.price_per_seat),
    seatsLeft: ride.seats_left,
    pickup: ride.pickup_point,
    dropoff: ride.dropoff_point,
    // The API has no notion of how far the rider is from the pickup — that
    // needs the device's location, which is a separate feature.
    pickupDistance: '',
    dropoffDistance: '',
    driver: toDriver(ride),
    vehicle: toVehicle(ride),
    recommended: ride.is_recommended,
  };
}

/** `2026-09-01`, the format the ride search's `date` filter expects. */
export function toApiDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
